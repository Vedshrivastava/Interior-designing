import FinanceWork from '../models/financeWork.js';
import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import FinanceLabourRate from '../models/financeLabourRate.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import FinanceProject from '../models/financeProject.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceLabourAdvance from '../models/financeLabourAdvance.js';
import FinanceLabourDeduction from '../models/financeLabourDeduction.js';
import FinanceLabourPayment from '../models/financeLabourPayment.js';
import FinanceCompanySettings from '../models/financeCompanySettings.js';
import { getApprovedBillingByWorkId, splitApprovedAreaByShare } from './financeReports.js';
import PDFDocument from 'pdfkit';
import { writeLetterhead, writeSectionHeading, writeSignatureLine, writeFooter, drawInfoBox, drawTable, contentBox, formatCurrency, formatDate, BRAND_GREEN, paintPageBackground } from '../utils/pdfLetterhead.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/*
 * Mirrors computeContractorLedger. Labour never had a per-measurement approval
 * flag (every logged sqft was immediately payable) — this is the one
 * genuine behavior change: Earnings (the figure that feeds Balance
 * Payable) now only counts "Approved" area, same billing-derived source as
 * the contractor side (see financeReports.js's computeWorkApprovedBilling
 * header comment — issuing a running bill to the client is the engineer's
 * approval act). Total (every logged sqft, unconditional) is tracked
 * alongside it per work; the gap is unapprovedAreaSqft/unapprovedAmount,
 * never a separately entered figure. The engineer's periodic review and a
 * supervisor's on-the-spot catch still show up only as financeLabourDeduction
 * rows, exactly like Advances/Payments — nothing computed, just summed —
 * and now subtract from Approved rather than Total.
 *
 * Balance Payable = Approved Earnings − Advances − Deductions − Payments.
 */
const computeLabourLedger = async (labourerId, projectId) => {
    const labourer = await FinanceLabourer.findOne({ _id: labourerId, deleted: { $ne: true } });
    if (!labourer) throw new Error('Labourer not found');

    const assignments = await FinanceWorkLabourAssignment.find({ labourerId, deleted: { $ne: true } });
    const workIds = assignments.map(a => a.workId);

    const workFilter = { _id: { $in: workIds }, deleted: { $ne: true } };
    if (projectId) workFilter.projectId = projectId;
    const works = await FinanceWork.find(workFilter).sort({ createdAt: -1 });

    const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
    const projects = await FinanceProject.find({ _id: { $in: projectIds } });
    const projectNameById = new Map(projects.map(p => [p._id.toString(), p.name]));

    const rates = await FinanceLabourRate.find({
        projectId: { $in: projectIds }, labourerId, deleted: { $ne: true },
    });
    const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r]));

    const areaByWork = new Map(); // workId -> { totalArea, allLabourersArea }
    for (const w of works) areaByWork.set(w._id.toString(), { totalArea: 0, allLabourersArea: 0 });

    const [measurements, allLabourerMeasurements, approvedBillingByWorkId] = await Promise.all([
        works.length
            ? FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, labourerId, deleted: { $ne: true } })
                .populate('workId', 'workType')
                .sort({ date: -1 })
            : [],
        // Every labourer's measurements on these works — needed to
        // proportionally split a work's billed area when more than one
        // labourer contributes to it (see splitApprovedAreaByShare).
        works.length
            ? FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId areaCoveredSqft')
            : [],
        works.length ? getApprovedBillingByWorkId(works.map(w => w._id)) : new Map(),
    ]);
    for (const m of allLabourerMeasurements) {
        const key = m.workId.toString();
        const cur = areaByWork.get(key) || { totalArea: 0, allLabourersArea: 0 };
        cur.allLabourersArea += m.areaCoveredSqft;
        areaByWork.set(key, cur);
    }
    for (const m of measurements) {
        const workKey = m.workId._id.toString();
        const cur = areaByWork.get(workKey) || { totalArea: 0, allLabourersArea: 0 };
        cur.totalArea += m.areaCoveredSqft;
        areaByWork.set(workKey, cur);
    }

    let earningsTotal = 0;
    let totalAmountTotal = 0;
    let unapprovedAmountTotal = 0;
    const worksOut = [];
    for (const w of works) {
        const workKey = w._id.toString();
        const { totalArea, allLabourersArea } = areaByWork.get(workKey);
        const rate = rateByKey.get(`${w.projectId}_${w.workType}`);
        const rateValue = rate ? rate.ratePerSqft : 0;
        const workApprovedBilling = approvedBillingByWorkId.get(workKey) || { areaSqft: 0, date: null };
        const approvedArea = splitApprovedAreaByShare(workApprovedBilling.areaSqft, totalArea, allLabourersArea);
        const unapprovedArea = round2(totalArea - approvedArea);
        const totalAmount = round2(rate ? totalArea * rateValue : 0);
        const earnings = round2(rate ? approvedArea * rateValue : 0);
        const unapprovedAmount = round2(rate ? unapprovedArea * rateValue : 0);
        earningsTotal += earnings;
        totalAmountTotal += totalAmount;
        unapprovedAmountTotal += unapprovedAmount;
        worksOut.push({
            _id: w._id,
            projectId: w.projectId, projectName: projectNameById.get(w.projectId.toString()) || '—',
            workType: w.workType,
            estimatedAreaSqft: w.estimatedAreaSqft, completedAreaSqft: round2(totalArea),
            approvedAreaSqft: approvedArea, unapprovedAreaSqft: unapprovedArea,
            approvedDate: approvedArea > 0 ? workApprovedBilling.date : null,
            status: w.status,
            rate: rate ? rate.ratePerSqft : null,
            totalAmount, earnings, unapprovedAmount,
        });
    }

    const moneyFilter = { labourerId, deleted: { $ne: true } };
    if (projectId) moneyFilter.projectId = projectId;
    const [advances, deductions, payments] = await Promise.all([
        FinanceLabourAdvance.find(moneyFilter).sort({ date: -1 }),
        FinanceLabourDeduction.find(moneyFilter).sort({ date: -1 }),
        FinanceLabourPayment.find(moneyFilter).populate('bankAccountId', 'accountName').sort({ date: -1 }),
    ]);

    const advancesTotal = advances.reduce((sum, a) => sum + a.amount, 0);
    const deductionsTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
    const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    earningsTotal = round2(earningsTotal);
    totalAmountTotal = round2(totalAmountTotal);
    unapprovedAmountTotal = round2(unapprovedAmountTotal);
    const balancePayable = round2(earningsTotal - advancesTotal - deductionsTotal - paymentsTotal);

    return {
        labourer,
        labourerId: labourer._id, labourerName: labourer.name,
        works: worksOut, measurements, advances, deductions, payments,
        totals: {
            earnings: earningsTotal, totalAmount: totalAmountTotal, unapprovedAmount: unapprovedAmountTotal,
            advances: advancesTotal, deductions: deductionsTotal, payments: paymentsTotal, balancePayable,
        },
    };
};

const getLabourLedger = async (req, res) => {
    try {
        const { labourerId } = req.params;
        const { projectId } = req.query;
        const { labourer, ...data } = await computeLabourLedger(labourerId, projectId);
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error computing labour ledger' });
    }
};

// Per-project payment statement — mirrors downloadContractorBillStatement.
// No GSTIN line (individual labourers aren't GST entities) and no UTR/TDS
// payment columns (financeLabourPayment has neither field).
const downloadLabourBillStatement = async (req, res) => {
    try {
        const { labourerId } = req.params;
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });

        const { labourer, ...data } = await computeLabourLedger(labourerId, projectId);
        const project = await FinanceProject.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        const workTypeById = new Map(data.works.map(w => [w._id.toString(), w.workType]));

        const company = await FinanceCompanySettings.findOne({ deleted: { $ne: true } })
            .populate('primaryBankAccountId', 'accountName bankName accountNumber ifscCode').lean();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Labour-Statement-${labourer.name.replace(/[^a-z0-9]+/gi, '-')}-${project.name.replace(/[^a-z0-9]+/gi, '-')}.pdf"`);

        const doc = new PDFDocument({ margin: 50, bufferPages: true });
        doc.pipe(res);
        doc.on('pageAdded', () => paintPageBackground(doc));
        paintPageBackground(doc);

        const { left, right, width } = contentBox(doc);

        await writeLetterhead(doc, 'Labour Payment Statement', company, `${project.name}  •  ${formatDate(new Date())}`);

        const infoTopY = doc.y;
        const colWidth = (width - 24) / 2;
        const leftBottom = drawInfoBox(doc, left, colWidth, 'Labourer', [labourer.name], company);
        doc.y = infoTopY;
        const rightBottom = drawInfoBox(doc, left + colWidth + 24, colWidth, 'Project', [
            project.name,
            project.siteLocation,
        ], company);
        doc.y = Math.max(leftBottom, rightBottom) + 8;

        writeSectionHeading(doc, 'Work-wise Breakdown', company);
        drawTable(doc, {
            company,
            columns: [
                { label: 'Work Type', width: 88, align: 'left' },
                { label: 'Total Sqft', width: 70, align: 'right' },
                { label: 'Approved Sqft', width: 80, align: 'right' },
                { label: 'Unapproved Sqft', width: 100, align: 'right' },
                { label: 'Rate/Sqft', width: 62, align: 'right' },
                { label: 'Approved Earnings', width: 112, align: 'right' },
            ],
            rows: data.works.map(w => [
                w.workType,
                String(w.completedAreaSqft),
                String(w.approvedAreaSqft),
                String(w.unapprovedAreaSqft),
                w.rate ? formatCurrency(w.rate) : '—',
                formatCurrency(w.earnings),
            ]),
        });
        doc.fontSize(8).fillColor('#888888')
            .text('Approved sqft reflects work already included in an issued client bill; unapproved sqft has been measured but not yet billed to the client.', left, doc.y, { width });
        doc.fillColor('#000000').fontSize(10);
        doc.moveDown(0.6);

        if (data.deductions.length > 0) {
            writeSectionHeading(doc, 'Deductions', company);
            drawTable(doc, {
                company,
                columns: [
                    { label: 'Date', width: 67, align: 'left' },
                    { label: 'Work', width: 125, align: 'left' },
                    { label: 'Sqft', width: 59, align: 'right' },
                    { label: 'Amount', width: 84, align: 'right' },
                    { label: 'Reason', width: 177, align: 'left' },
                ],
                rows: data.deductions.map(d => [
                    formatDate(d.date),
                    workTypeById.get((d.workId?._id || d.workId)?.toString()) || '—',
                    d.areaSqft ?? '—',
                    formatCurrency(d.amount),
                    d.reason || '—',
                ]),
            });
            doc.moveDown(0.4);
        }

        if (data.advances.length > 0) {
            writeSectionHeading(doc, 'Advances', company);
            drawTable(doc, {
                company,
                columns: [
                    { label: 'Date', width: 84, align: 'left' },
                    { label: 'Amount', width: 109, align: 'right' },
                    { label: 'Mode', width: 117, align: 'left' },
                    { label: 'Notes', width: 202, align: 'left' },
                ],
                rows: data.advances.map(a => [formatDate(a.date), formatCurrency(a.amount), a.paymentMode || '—', a.notes || '—']),
            });
            doc.moveDown(0.4);
        }

        if (data.payments.length > 0) {
            writeSectionHeading(doc, 'Payments', company);
            drawTable(doc, {
                company,
                columns: [
                    { label: 'Date', width: 100, align: 'left' },
                    { label: 'Amount', width: 125, align: 'right' },
                    { label: 'Mode', width: 151, align: 'left' },
                    { label: 'Account', width: 136, align: 'left' },
                ],
                rows: data.payments.map(p => [formatDate(p.date), formatCurrency(p.amount), p.paymentMode || '—', p.bankAccountId?.accountName || 'Cash']),
            });
            doc.moveDown(0.4);
        }

        const totalsBoxWidth = 260;
        const totalsX = right - totalsBoxWidth;
        const labelWidth = 150;
        const valueWidth = totalsBoxWidth - labelWidth;
        let ty = doc.y;
        doc.font('Helvetica').fontSize(10);
        [
            ['Approved Earnings', data.totals.earnings],
            ['Advances', -data.totals.advances],
            ['Deductions', -data.totals.deductions],
            ['Payments', -data.totals.payments],
        ].forEach(([label, value]) => {
            doc.text(label, totalsX, ty, { width: labelWidth });
            doc.text(formatCurrency(Math.abs(value)), totalsX + labelWidth, ty, { width: valueWidth, align: 'right' });
            ty += 16;
        });
        doc.moveTo(totalsX, ty).lineTo(right, ty).strokeColor(BRAND_GREEN).lineWidth(1).stroke();
        ty += 6;
        doc.y = ty + 10;

        // Same convention as LabourLedgerView.jsx's own totals row: color
        // keys off > 0 (red = owed), but the "Extra Paid" label specifically
        // keys off < 0 — a zero balance reads "Balance Payable: Rs. 0" in
        // green, matching that exact on-screen behavior.
        const balancePayable = data.totals.balancePayable;
        const bannerY = doc.y;
        const bannerH = 36;
        doc.rect(left, bannerY, width, bannerH).fill(balancePayable > 0 ? '#fdecea' : '#eafaf1');
        doc.fillColor(balancePayable > 0 ? '#c0392b' : '#1e8449').font('Helvetica-Bold').fontSize(12.5)
            .text(
                `${balancePayable < 0 ? 'Extra Paid' : 'Balance Payable'}: ${formatCurrency(Math.abs(balancePayable))}`,
                left + 14, bannerY + 11
            );
        doc.fillColor('#000000').font('Helvetica').fontSize(10);
        doc.y = bannerY + bannerH + 10;

        // Bank fields are required:true on financeLabourer going forward, but
        // records saved before that constraint existed can still be blank —
        // stay silent rather than print "Account Name: undefined".
        if (labourer.bankName || labourer.accountName || labourer.accountNumber || labourer.ifscCode) {
            drawInfoBox(doc, left, width, 'Pay To', [
                labourer.bankName || null,
                labourer.accountName ? `Account Name: ${labourer.accountName}` : null,
                labourer.accountNumber ? `Account No: ${labourer.accountNumber}` : null,
                labourer.ifscCode ? `IFSC: ${labourer.ifscCode}` : null,
            ], company);
        }

        writeSignatureLine(doc, company);
        writeFooter(doc, company);
        doc.end();
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ success: false, message: err.message || 'Error generating labour statement PDF' });
    }
};

export { getLabourLedger, downloadLabourBillStatement };
