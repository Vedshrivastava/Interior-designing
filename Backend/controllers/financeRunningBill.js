import FinanceRunningBill from '../models/financeRunningBill.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import FinanceProject from '../models/financeProject.js';
import FinanceReceipt from '../models/financeReceipt.js';
import FinanceCompanySettings from '../models/financeCompanySettings.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';
import PDFDocument from 'pdfkit';
import { writeLetterhead, writeSectionHeading, writeFooter, formatCurrency, formatDate } from '../utils/pdfLetterhead.js';

const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material'];

const listRunningBills = async (req, res) => {
    try {
        const { projectId, status } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const filter = { projectId, deleted: { $ne: true } };
        if (status) filter.status = status;
        const items = await FinanceRunningBill.find(filter).sort({ billDate: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching running bills' });
    }
};

/*
 * Shared by generate() and preview() so the UI's "preview line items before
 * confirming" step and the actual generation can never compute different
 * numbers. Pulls approved, unbilled measurements in the date range, groups
 * by work, and snapshots the current financeWorkTypeRate per work type.
 * Throws with a plain message on any validation failure — callers turn
 * that into a 400.
 */
const computeBillLineItems = async (projectId, periodFrom, periodTo) => {
    const project = await FinanceProject.findById(projectId);
    if (!project) throw new Error('Project not found');
    if (!BILLABLE_CONTRACT_TYPES.includes(project.contractType)) {
        throw new Error("Advance-contract projects don't use Running Bills — they track payment via the advance fields instead");
    }

    const measurements = await FinanceMeasurement.find({
        projectId,
        deleted: { $ne: true },
        engineerApproved: true,
        billedInRunningBillId: null,
        date: { $gte: new Date(periodFrom), $lte: new Date(periodTo) },
    }).populate('workId', 'workType');

    if (measurements.length === 0) {
        throw new Error('No approved, unbilled measurements in this date range');
    }

    // Group by work
    const byWork = new Map();
    for (const m of measurements) {
        if (!m.workId) continue; // orphaned reference — skip defensively
        const key = m.workId._id.toString();
        if (!byWork.has(key)) byWork.set(key, { workId: m.workId._id, workType: m.workId.workType, areaBilledSqft: 0, measurementIds: [] });
        const entry = byWork.get(key);
        entry.areaBilledSqft += m.areaCoveredSqft;
        entry.measurementIds.push(m._id);
    }

    const workTypes = [...new Set([...byWork.values()].map(e => e.workType))];
    const rates = await FinanceWorkTypeRate.find({ projectId, workType: { $in: workTypes }, deleted: { $ne: true } });
    const rateByWorkType = new Map(rates.map(r => [r.workType, r]));

    const missingRates = workTypes.filter(wt => !rateByWorkType.has(wt));
    if (missingRates.length > 0) {
        throw new Error(`No client rate configured for: ${missingRates.join(', ')} — add a Work Type Rate first`);
    }

    const lineItems = [...byWork.values()].map(entry => {
        const rate = rateByWorkType.get(entry.workType);
        return {
            workId: entry.workId,
            workType: entry.workType,
            areaBilledSqft: entry.areaBilledSqft,
            clientRatePerSqft: rate.clientRatePerSqft,
            amount: entry.areaBilledSqft * rate.clientRatePerSqft,
        };
    });

    const totalAmount = lineItems.reduce((sum, li) => sum + li.amount, 0);
    const measurementIds = measurements.map(m => m._id);

    return { lineItems, totalAmount, measurementIds, project };
};

const previewRunningBill = async (req, res) => {
    try {
        const { projectId, periodFrom, periodTo } = req.query;
        if (!projectId || !periodFrom || !periodTo) {
            return res.status(400).json({ success: false, message: 'projectId, periodFrom, and periodTo are required' });
        }
        const { lineItems, totalAmount } = await computeBillLineItems(projectId, periodFrom, periodTo);
        res.json({ success: true, data: { lineItems, totalAmount } });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// gstRate is optional — when given, gstAmount is computed off totalAmount
// and frozen here at generation time, same as every other amount on this
// document. Omitting it (the default for every bill before this field
// existed) leaves both fields unset.
const generateRunningBill = async (req, res) => {
    try {
        const { projectId, periodFrom, periodTo, billDate, gstRate } = req.body;
        if (!projectId || !periodFrom || !periodTo) {
            return res.status(400).json({ success: false, message: 'projectId, periodFrom, and periodTo are required' });
        }

        const { lineItems, totalAmount, measurementIds, project } = await computeBillLineItems(projectId, periodFrom, periodTo);

        const billCount = await FinanceRunningBill.countDocuments({ projectId });
        const billNumber = String(billCount + 1);

        const hasGst = gstRate !== undefined && gstRate !== null && gstRate !== '';
        const bill = new FinanceRunningBill({
            projectId, billNumber,
            billDate: billDate || new Date(),
            periodFrom, periodTo,
            lineItems, totalAmount,
            gstRate: hasGst ? Number(gstRate) : null,
            gstAmount: hasGst ? totalAmount * (Number(gstRate) / 100) : null,
            status: 'draft',
        });
        await bill.save();

        await FinanceMeasurement.updateMany(
            { _id: { $in: measurementIds } },
            { billedInRunningBillId: bill._id }
        );

        broadcast({ type: 'financeRunningBillsChanged', projectId });

        await logActivity({
            eventType: 'running_bill_generated',
            entityType: 'financeRunningBill',
            entityId: bill._id,
            projectId,
            summary: `Running Bill #${billNumber} generated for ${project.name} — ₹${totalAmount}`,
            amount: totalAmount,
            req,
        });

        res.json({ success: true, message: `Bill #${billNumber} generated`, data: bill });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error generating bill' });
    }
};

const updateRunningBillStatus = async (req, res) => {
    try {
        const { _id, status } = req.body;
        if (!['draft', 'issued'].includes(status)) {
            return res.status(400).json({ success: false, message: 'status must be draft or issued' });
        }
        const item = await FinanceRunningBill.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.status = status;
        await item.save();
        broadcast({ type: 'financeRunningBillsChanged', projectId: item.projectId });
        res.json({ success: true, message: 'Bill status updated', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating bill status' });
    }
};

// Unlike removeMeasurement/removeWork (which leave their downstream effects
// as historical artifacts on delete), removing a bill DOES reverse its one
// effect: it clears billedInRunningBillId on every measurement it consumed.
// Without that, those measurements would be permanently stuck "billed" to a
// deleted bill and could never be billed again — a real dead end, not just
// a stale record.
const removeRunningBill = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceRunningBill.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceMeasurement.updateMany({ billedInRunningBillId: item._id }, { billedInRunningBillId: null });

        broadcast({ type: 'financeRunningBillsChanged', projectId: item.projectId });
        res.json({ success: true, message: `Bill #${item.billNumber} moved to recovery bin — its measurements are billable again` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing bill' });
    }
};

/*
 * Shared by getBillStatement (JSON) and downloadBillStatement (PDF).
 *
 * INTERPRETATION FLAG: outstanding balance here counts only receipts with
 * this exact bill's _id in runningBillId — not every receipt against the
 * project (which is what the Receivables summary totals). A lump-sum
 * receipt not tied to a specific bill (financeReceipt.runningBillId can be
 * null — see that model's schema comment) intentionally doesn't reduce
 * any one bill's own balance here, since there's no honest way to say
 * which bill it paid down. This is a deliberate scoping choice matching
 * what "this bill's outstanding balance" should actually mean, not a
 * shortcut copy of the project-wide Receivables total.
 */
const computeBillStatement = async (billId) => {
    const bill = await FinanceRunningBill.findOne({ _id: billId, deleted: { $ne: true } });
    if (!bill) return null;

    const project = await FinanceProject.findById(bill.projectId).populate('clientId');
    const client = project?.clientId;

    const payments = await FinanceReceipt.find({ runningBillId: bill._id, deleted: { $ne: true } }).sort({ receiptDate: 1 });
    const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    const grandTotal = bill.totalAmount + (bill.gstAmount || 0);

    // .lean() — spreading a hydrated Mongoose document ({ ...doc }) silently
    // drops some schema fields (companyName among them) in pdfLetterhead.js.
    const company = await FinanceCompanySettings.findOne({ deleted: { $ne: true } }).lean();

    return {
        company,
        client: client ? { name: client.name, phone: client.phone, email: client.email, address: client.address, gstNumber: client.gstNumber } : null,
        project: project ? { projectId: project._id, name: project.name, siteLocation: project.siteLocation } : null,
        bill: {
            billId: bill._id, billNumber: bill.billNumber, billDate: bill.billDate,
            periodFrom: bill.periodFrom, periodTo: bill.periodTo, status: bill.status,
            lineItems: bill.lineItems, totalAmount: bill.totalAmount,
            gstRate: bill.gstRate, gstAmount: bill.gstAmount, grandTotal,
        },
        payments, paidTotal,
        outstandingBalance: grandTotal - paidTotal,
    };
};

const getBillStatement = async (req, res) => {
    try {
        const data = await computeBillStatement(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Bill not found' });
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing bill statement' });
    }
};

const downloadBillStatement = async (req, res) => {
    try {
        const data = await computeBillStatement(req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Bill not found' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Bill-Statement-${data.bill.billNumber}.pdf"`);

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        await writeLetterhead(doc, `Client Bill Statement — Bill #${data.bill.billNumber}`, data.company);

        doc.font('Helvetica-Bold').text('Bill To:');
        doc.font('Helvetica').text(data.client?.name || '—');
        if (data.client?.address) doc.text(data.client.address);
        if (data.client?.phone) doc.text(`Phone: ${data.client.phone}`);
        if (data.client?.gstNumber) doc.text(`GSTIN: ${data.client.gstNumber}`);

        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Project:');
        doc.font('Helvetica').text(data.project?.name || '—');
        if (data.project?.siteLocation) doc.text(data.project.siteLocation);

        doc.moveDown(0.3);
        doc.text(`Bill Date: ${formatDate(data.bill.billDate)}`);
        if (data.bill.periodFrom && data.bill.periodTo) doc.text(`Period: ${formatDate(data.bill.periodFrom)} to ${formatDate(data.bill.periodTo)}`);
        doc.text(`Status: ${data.bill.status === 'issued' ? 'Issued' : 'Draft'}`);

        writeSectionHeading(doc, 'Line Items', data.company);
        const colX = { workType: doc.page.margins.left, area: 220, rate: 320, amount: 420 };
        const lineHeight = doc.currentLineHeight() + 4;

        doc.font('Helvetica-Bold');
        let rowY = doc.y;
        doc.text('Work Type', colX.workType, rowY);
        doc.text('Area (sqft)', colX.area, rowY);
        doc.text('Rate/sqft', colX.rate, rowY);
        doc.text('Amount', colX.amount, rowY);
        rowY += lineHeight;

        doc.font('Helvetica');
        data.bill.lineItems.forEach(li => {
            doc.text(li.workType, colX.workType, rowY);
            doc.text(String(li.areaBilledSqft), colX.area, rowY);
            doc.text(formatCurrency(li.clientRatePerSqft), colX.rate, rowY);
            doc.text(formatCurrency(li.amount), colX.amount, rowY);
            rowY += lineHeight;
        });
        doc.y = rowY;

        doc.moveDown(0.5);
        doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(0.3);

        doc.text(`Subtotal: ${formatCurrency(data.bill.totalAmount)}`, { align: 'right' });
        if (data.bill.gstAmount) {
            doc.text(`GST (${data.bill.gstRate}%): ${formatCurrency(data.bill.gstAmount)}`, { align: 'right' });
        }
        doc.font('Helvetica-Bold').text(`Grand Total: ${formatCurrency(data.bill.grandTotal)}`, { align: 'right' }).font('Helvetica');

        writeSectionHeading(doc, 'Payment History', data.company);
        if (data.payments.length === 0) {
            doc.text('No payments recorded against this bill yet.');
        } else {
            data.payments.forEach(p => {
                doc.text(`${formatDate(p.receiptDate)} — ${formatCurrency(p.amount)}${p.paymentMode ? ` (${p.paymentMode})` : ''}${p.utrNumber ? ` — UTR ${p.utrNumber}` : ''}`);
            });
            doc.font('Helvetica-Bold').text(`Total Paid: ${formatCurrency(data.paidTotal)}`).font('Helvetica');
        }

        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(12)
            .fillColor(data.outstandingBalance > 0 ? '#c0392b' : '#27ae60')
            .text(`Outstanding Balance: ${formatCurrency(data.outstandingBalance)}`)
            .fillColor('#000000').font('Helvetica').fontSize(10);

        writeFooter(doc, data.company);
        doc.end();
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating bill statement PDF' });
    }
};

export {
    listRunningBills, previewRunningBill, generateRunningBill, updateRunningBillStatus, removeRunningBill,
    getBillStatement, downloadBillStatement,
};
