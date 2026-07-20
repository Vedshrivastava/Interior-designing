import FinanceRunningBill from '../models/financeRunningBill.js';
import FinanceWork from '../models/financeWork.js';
import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import FinanceProject from '../models/financeProject.js';
import FinanceReceipt from '../models/financeReceipt.js';
import FinanceCompanySettings from '../models/financeCompanySettings.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';
import { computeWorkExpectedPay, splitApprovedAreaByShare } from './financeReports.js';
import PDFDocument from 'pdfkit';
import { writeLetterhead, writeSectionHeading, writePaymentDetails, writeSignatureLine, writeFooter, drawInfoBox, measureInfoBoxHeight, drawTable, contentBox, formatCurrency, formatDate, getTheme, paintPageBackground } from '../utils/pdfLetterhead.js';

// Advance-contract projects bill exactly like With Material once work
// starts — the advance is a credit drawn down against the first bill(s),
// not a separate billing track (see applyAdvanceCredit below).
const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material', 'advance'];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

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

// How much sqft is available to approve (bill) for one work type in a
// project — sqft that's already been REVIEWED (see WorkReviewPanel /
// financeWorkReview) minus what's already in an issued bill
// (computeWorkExpectedPay's availableToBillAreaSqft), summed across every
// Work of that type. Deliberately NOT the same as unapprovedAreaSqft
// (Total − Reviewed, "still pending review") — a work with nothing
// reviewed yet correctly offers 0 here regardless of how much is logged,
// which is what actually gates Generate Bill on review having happened
// first. Reused by both the "what can I approve" menu and the actual
// generation's own validation, so they can never disagree about the
// ceiling.
const computeAvailableByWorkType = async (projectId) => {
    const works = await FinanceWork.find({ projectId, deleted: { $ne: true } });
    const worksByType = new Map();
    for (const w of works) {
        if (!worksByType.has(w.workType)) worksByType.set(w.workType, []);
        worksByType.get(w.workType).push(w);
    }
    const workTypes = [...worksByType.keys()];
    const rates = await FinanceWorkTypeRate.find({ projectId, workType: { $in: workTypes }, deleted: { $ne: true } });
    const rateByType = new Map(rates.map(r => [r.workType, r.clientRatePerSqft]));

    const result = [];
    for (const [workType, typeWorks] of worksByType) {
        const expectedPays = await Promise.all(typeWorks.map(w => computeWorkExpectedPay(w)));
        const availableSqft = round2(expectedPays.reduce((s, wp) => s + wp.availableToBillAreaSqft, 0));
        if (availableSqft <= 0) continue;
        result.push({ workType, availableSqft, clientRatePerSqft: rateByType.get(workType) ?? null });
    }
    return result;
};

const getAvailableToApprove = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const project = await FinanceProject.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        if (!BILLABLE_CONTRACT_TYPES.includes(project.contractType)) {
            return res.status(400).json({ success: false, message: 'This project\'s contract type does not use Running Bills' });
        }
        const data = await computeAvailableByWorkType(projectId);
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing available work' });
    }
};

/*
 * Builds a bill's lineItems from the engineer's own typed sqft-per-work-type
 * figures (`workTypeSqft: { [workType]: approvedSqft }`) — never an
 * auto-sum of measurements. The ceiling here is sqft that's already been
 * REVIEWED (WorkReviewPanel) and not yet billed — a work type with nothing
 * reviewed yet offers 0, blocking it from being billed until review
 * happens first, no separate explicit check needed. One work type can
 * span several Works (e.g. two rooms both getting Putty) — schema still
 * needs one lineItem per Work, so the typed figure is distributed
 * proportionally to each Work's own share of what's available
 * (splitApprovedAreaByShare, same helper the Ledgers use for the
 * identical multi-work problem).
 */
const computeBillLineItems = async (projectId, workTypeSqft) => {
    const project = await FinanceProject.findById(projectId);
    if (!project) throw new Error('Project not found');
    if (!BILLABLE_CONTRACT_TYPES.includes(project.contractType)) {
        throw new Error('This project\'s contract type does not use Running Bills');
    }

    const entries = Object.entries(workTypeSqft || {}).filter(([, sqft]) => Number(sqft) > 0);
    if (!entries.length) throw new Error('Enter approved sqft for at least one work type');

    const workTypes = entries.map(([wt]) => wt);
    const rates = await FinanceWorkTypeRate.find({ projectId, workType: { $in: workTypes }, deleted: { $ne: true } });
    const rateByType = new Map(rates.map(r => [r.workType, r]));
    const missingRates = workTypes.filter(wt => !rateByType.has(wt));
    if (missingRates.length > 0) {
        throw new Error(`No client rate configured for: ${missingRates.join(', ')} — add a Work Type Rate first`);
    }

    const lineItems = [];
    for (const [workType, sqftRaw] of entries) {
        const approvedSqft = Number(sqftRaw);
        const works = await FinanceWork.find({ projectId, workType, deleted: { $ne: true } });
        const expectedPays = await Promise.all(works.map(w => computeWorkExpectedPay(w)));
        const totalAvailable = round2(expectedPays.reduce((s, wp) => s + wp.availableToBillAreaSqft, 0));
        if (approvedSqft > totalAvailable) {
            throw new Error(`Cannot approve more than the ${totalAvailable} sqft available for ${workType} — review outstanding sqft first (Payables/Receivables → Deductions)`);
        }
        const rate = rateByType.get(workType);
        works.forEach((w, i) => {
            const workAvailable = expectedPays[i].availableToBillAreaSqft;
            if (workAvailable <= 0) return;
            const workSqft = splitApprovedAreaByShare(approvedSqft, workAvailable, totalAvailable);
            if (workSqft <= 0) return;
            lineItems.push({
                workId: w._id, workType,
                areaBilledSqft: workSqft, clientRatePerSqft: rate.clientRatePerSqft,
                amount: round2(workSqft * rate.clientRatePerSqft),
            });
        });
    }
    if (!lineItems.length) throw new Error('Nothing to bill — the entered sqft split to zero across this work type\'s works');

    const totalAmount = round2(lineItems.reduce((sum, li) => sum + li.amount, 0));
    return { lineItems, totalAmount, project };
};

// Applies as much of an Advance-contract project's still-undrawn advance
// credit as fits against a newly generated bill, oldest first (in
// practice there's only ever one). A credit smaller than the bill's
// grandTotal gets fully linked to it and leaves the rest of the bill to
// be paid normally; a credit bigger than the bill gets split — the
// portion this bill consumes becomes its own linked receipt, the
// remainder stays unlinked (isAdvance, runningBillId null) for the next
// bill. No-op for with_material/without_material projects, and for
// advance projects with nothing left undrawn.
const applyAdvanceCredit = async (projectId, bill) => {
    let remaining = bill.totalAmount + (bill.gstAmount || 0);
    if (remaining <= 0) return;

    const undrawn = await FinanceReceipt.find({ projectId, isAdvance: true, runningBillId: null, deleted: { $ne: true } }).sort({ receiptDate: 1 });
    for (const receipt of undrawn) {
        if (remaining <= 0) break;
        if (receipt.amount <= remaining) {
            receipt.runningBillId = bill._id;
            await receipt.save();
            remaining -= receipt.amount;
        } else {
            const appliedAmount = remaining;
            receipt.amount -= appliedAmount;
            await receipt.save(); // stays unlinked, reduced, for the next bill
            await FinanceReceipt.create({
                clientId: receipt.clientId, projectId: receipt.projectId,
                runningBillId: bill._id, amount: appliedAmount, receiptDate: receipt.receiptDate,
                isAdvance: true, notes: `Advance applied to Bill #${bill.billNumber}`,
            });
            remaining = 0;
        }
    }
};

// gstRate is optional — when given, gstAmount is computed off totalAmount
// and frozen here at generation time, same as every other amount on this
// document. If the request omits it, this falls back to
// financeCompanySettings.defaultGstRate (Settings > GST) rather than
// leaving the bill GST-less — the Admin form only *prefills* that field
// client-side, so a cleared/skipped field would otherwise silently drop
// GST off the statement even though a business-wide default is configured.
const generateRunningBill = async (req, res) => {
    try {
        const { projectId, periodFrom, periodTo, billDate, gstRate, workTypeSqft } = req.body;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });

        const { lineItems, totalAmount, project } = await computeBillLineItems(projectId, workTypeSqft);

        const billCount = await FinanceRunningBill.countDocuments({ projectId });
        const billNumber = String(billCount + 1);

        const hasRequestGst = gstRate !== undefined && gstRate !== null && gstRate !== '';
        let effectiveGstRate = hasRequestGst ? Number(gstRate) : null;
        if (!hasRequestGst) {
            const company = await FinanceCompanySettings.findOne({ deleted: { $ne: true } }, 'defaultGstRate').lean();
            if (company?.defaultGstRate !== null && company?.defaultGstRate !== undefined) {
                effectiveGstRate = Number(company.defaultGstRate);
            }
        }
        const hasGst = effectiveGstRate !== null;
        const resolvedBillDate = billDate || new Date();

        const bill = new FinanceRunningBill({
            projectId, billNumber,
            billDate: resolvedBillDate,
            // Descriptive only now (shown on the statement PDF) — nothing
            // queries by these anymore, so a sensible fallback beats a
            // hard requirement.
            periodFrom: periodFrom || resolvedBillDate, periodTo: periodTo || resolvedBillDate,
            lineItems, totalAmount,
            gstRate: hasGst ? effectiveGstRate : null,
            gstAmount: hasGst ? totalAmount * (effectiveGstRate / 100) : null,
            status: 'draft',
        });
        await bill.save();

        if (project.contractType === 'advance') {
            await applyAdvanceCredit(projectId, bill);
        }

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

// GST is only editable while a bill is still 'draft' — once issued, its
// gstRate/gstAmount become the frozen source of truth for Output GST
// reporting (see financeReports.js's CA Monthly Package, which sums
// gstAmount across status: 'issued' bills), so changing it after that
// point would silently rewrite already-reported tax figures. A bill can
// always be moved back to draft via updateRunningBillStatus first.
const updateRunningBillGst = async (req, res) => {
    try {
        const { _id, gstRate } = req.body;
        const item = await FinanceRunningBill.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        if (item.status !== 'draft') {
            return res.status(400).json({ success: false, message: 'GST can only be edited on a draft bill — set status back to Draft first' });
        }
        const hasGst = gstRate !== undefined && gstRate !== null && gstRate !== '';
        item.gstRate = hasGst ? Number(gstRate) : null;
        item.gstAmount = hasGst ? item.totalAmount * (Number(gstRate) / 100) : null;
        await item.save();
        broadcast({ type: 'financeRunningBillsChanged', projectId: item.projectId });
        res.json({ success: true, message: 'GST updated', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating GST' });
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
// A clean soft-delete now, nothing else to reverse — availability is
// derived fresh every time from issued bills' lineItems
// (computeWorkExpectedPay/getApprovedBillingByWorkId), not tracked on
// individual measurements, so deleting a bill automatically makes its sqft
// available to approve again without touching financeMeasurement at all.
const removeRunningBill = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceRunningBill.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();

        broadcast({ type: 'financeRunningBillsChanged', projectId: item.projectId });
        res.json({ success: true, message: `Bill #${item.billNumber} moved to recovery bin — its sqft is available to approve again` });
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
    const company = await FinanceCompanySettings.findOne({ deleted: { $ne: true } })
        .populate('primaryBankAccountId', 'accountName bankName accountNumber ifscCode').lean();

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

        // ?mode=bw renders the identical layout in a grayscale palette for
        // clients who print statements — same structure and weight, no
        // color, so a black-and-white printer isn't asked to render fills
        // it'll just turn to muddy gray anyway. Anything else (including no
        // param) falls back to the branded color theme.
        const mode = req.query.mode === 'bw' ? 'bw' : 'color';
        const theme = getTheme(mode);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Bill-Statement-${data.bill.billNumber}${mode === 'bw' ? '-BW' : ''}.pdf"`);

        const doc = new PDFDocument({ margin: 50, bufferPages: true });
        doc.pipe(res);
        doc.on('pageAdded', () => paintPageBackground(doc, theme));
        paintPageBackground(doc, theme);

        const { left, right, width } = contentBox(doc);

        await writeLetterhead(
            doc,
            'Client Bill Statement',
            data.company,
            `Bill #${data.bill.billNumber}  •  ${formatDate(data.bill.billDate)}`,
            theme
        );

        // Bill To / Bill Details side by side, rather than one long stack —
        // reads like a real invoice at a glance.
        const infoTopY = doc.y;
        const colWidth = (width - 24) / 2;
        const billToLines = [
            data.client?.name || '—',
            data.client?.address,
            data.client?.phone ? `Phone: ${data.client.phone}` : null,
            data.client?.gstNumber ? `GSTIN: ${data.client.gstNumber}` : null,
        ];
        const billDetailsLines = [
            data.project?.name ? `Project: ${data.project.name}` : null,
            data.project?.siteLocation,
            (data.bill.periodFrom && data.bill.periodTo) ? `Period: ${formatDate(data.bill.periodFrom)} – ${formatDate(data.bill.periodTo)}` : null,
            `Status: ${data.bill.status === 'issued' ? 'Issued' : 'Draft'}`,
        ];
        const matchedInfoHeight = Math.max(
            measureInfoBoxHeight(doc, colWidth, 'Bill To', billToLines),
            measureInfoBoxHeight(doc, colWidth, 'Bill Details', billDetailsLines),
        );
        const leftBottom = drawInfoBox(doc, left, colWidth, 'Bill To', billToLines, data.company, matchedInfoHeight, theme);
        doc.y = infoTopY;
        const rightBottom = drawInfoBox(doc, left + colWidth + 24, colWidth, 'Bill Details', billDetailsLines, data.company, matchedInfoHeight, theme);
        doc.y = Math.max(leftBottom, rightBottom) + 8;

        writeSectionHeading(doc, 'Line Items', theme);
        drawTable(doc, {
            theme,
            columns: [
                { label: 'Work Type', width: 182, align: 'left' },
                { label: 'Verified Area (sqft)', width: 120, align: 'right' },
                { label: 'Rate/sqft', width: 100, align: 'right' },
                { label: 'Amount', width: 110, align: 'right' },
            ],
            rows: data.bill.lineItems.map((li) => [
                li.workType,
                String(li.areaBilledSqft),
                formatCurrency(li.clientRatePerSqft),
                formatCurrency(li.amount),
            ]),
        });
        doc.fontSize(8).fillColor('#888888')
            .text('Area figures include only measurements verified and approved by the site engineer.', left, doc.y, { width });
        doc.fillColor('#000000').fontSize(10);
        doc.moveDown(0.6);

        // Totals — a solid, theme-primary-filled box (own visual weight,
        // wider than a plain right-aligned stack): light accent-on-primary
        // rows for Subtotal/GST, closed off with an accent rule and a
        // larger Grand Total row.
        const totalsBoxWidth = 260;
        const totalsX = right - totalsBoxWidth;
        const totalsPad = 14;
        const halfWidth = totalsBoxWidth / 2 - totalsPad;
        const rowH = 20;
        const boxTopY = doc.y;

        const lightRows = [['Subtotal', formatCurrency(data.bill.totalAmount)]];
        if (data.bill.gstAmount) lightRows.push([`GST (${data.bill.gstRate}%)`, formatCurrency(data.bill.gstAmount)]);
        const sacLine = (data.bill.gstAmount && data.company?.defaultSacCode) ? `SAC: ${data.company.defaultSacCode}` : null;

        const boxH = totalsPad + (lightRows.length * rowH) + (sacLine ? 14 : 0) + 8 + 34 + totalsPad;
        doc.rect(totalsX, boxTopY, totalsBoxWidth, boxH).fill(theme.primary);

        let ty = boxTopY + totalsPad;
        doc.font('Helvetica').fontSize(10);
        lightRows.forEach(([label, value]) => {
            doc.fillColor(theme.accent).text(label, totalsX + totalsPad, ty, { width: halfWidth });
            doc.fillColor(theme.onPrimary).text(value, totalsX + totalsBoxWidth / 2, ty, { width: halfWidth, align: 'right' });
            ty += rowH;
        });
        if (sacLine) {
            doc.fontSize(7.5).fillColor(theme.accent).text(sacLine, totalsX + totalsPad, ty, { width: totalsBoxWidth - totalsPad * 2, align: 'right' });
            doc.fontSize(10);
            ty += 14;
        }
        doc.moveTo(totalsX + totalsPad, ty + 2).lineTo(totalsX + totalsBoxWidth - totalsPad, ty + 2).strokeColor(theme.accent).lineWidth(1).stroke();
        ty += 10;
        doc.font('Helvetica-Bold').fontSize(11).fillColor(theme.accent).text('Grand Total', totalsX + totalsPad, ty + 5, { width: halfWidth });
        doc.fontSize(15).fillColor(theme.onPrimary).text(formatCurrency(data.bill.grandTotal), totalsX + totalsBoxWidth / 2, ty, { width: halfWidth, align: 'right' });
        doc.fillColor('#000000').font('Helvetica').fontSize(10);
        doc.y = boxTopY + boxH + 14;

        writeSectionHeading(doc, 'Payment History', theme);
        if (data.payments.length === 0) {
            doc.text('No payments recorded against this bill yet.');
            doc.moveDown(0.4);
        } else {
            drawTable(doc, {
                theme,
                columns: [
                    { label: 'Date', width: 100, align: 'left' },
                    { label: 'Amount', width: 130, align: 'right' },
                    { label: 'Mode', width: 140, align: 'left' },
                    { label: 'UTR / Reference', width: 142, align: 'left' },
                ],
                rows: data.payments.map((p) => [
                    formatDate(p.receiptDate),
                    formatCurrency(p.amount),
                    p.paymentMode || '—',
                    p.utrNumber || '—',
                ]),
            });
            doc.font('Helvetica-Bold').text(`Total Paid: ${formatCurrency(data.paidTotal)}`, { align: 'right' }).font('Helvetica');
            doc.moveDown(0.5);
        }

        // Outstanding balance — a warm callout (not a red/green alarm
        // banner) so the one number a client needs to act on stands out
        // without reading like a warning; a routine business document, not
        // a dunning notice.
        const positiveBalance = data.outstandingBalance > 0;
        const bannerY = doc.y;
        const bannerH = 38;
        doc.rect(left, bannerY, width, bannerH).fill(theme.bannerBg);
        doc.rect(left, bannerY, 4, bannerH).fill(theme.accent);
        doc.fillColor(theme.bannerLabel).font('Helvetica').fontSize(11.5)
            .text(positiveBalance ? 'Payment Due' : 'Fully Settled', left + 18, bannerY + (bannerH / 2) - 6);
        doc.font('Helvetica-Bold').fontSize(14).fillColor(theme.primary)
            .text(formatCurrency(Math.abs(data.outstandingBalance)), left + 18, bannerY + (bannerH / 2) - 7, { width: width - 32, align: 'right' });
        doc.fillColor('#000000').font('Helvetica').fontSize(10);
        doc.y = bannerY + bannerH + 10;

        writePaymentDetails(doc, data.company, theme);
        writeSignatureLine(doc, data.company);
        writeFooter(doc, data.company, theme);
        doc.end();
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating bill statement PDF' });
    }
};

export {
    listRunningBills, getAvailableToApprove, generateRunningBill, updateRunningBillGst, updateRunningBillStatus, removeRunningBill,
    getBillStatement, downloadBillStatement,
};
