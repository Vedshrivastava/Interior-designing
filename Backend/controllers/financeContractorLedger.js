import FinanceWork from '../models/financeWork.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceContractorRate from '../models/financeContractorRate.js';
import FinanceWorkContractorAssignment from '../models/financeWorkContractorAssignment.js';
import FinanceProject from '../models/financeProject.js';
import FinanceContractorAdvance from '../models/financeContractorAdvance.js';
import FinanceContractorDeduction from '../models/financeContractorDeduction.js';
import FinanceContractorPayment from '../models/financeContractorPayment.js';
import FinanceCompanySettings from '../models/financeCompanySettings.js';
import { assertContractorVendor } from '../utils/contractorVendor.js';
import { getApprovedBillingByWorkId, splitApprovedAreaByShare } from './financeReports.js';
import PDFDocument from 'pdfkit';
import { writeLetterhead, writeSectionHeading, writeSignatureLine, writeFooter, drawInfoBox, drawTable, contentBox, formatCurrency, formatDate, BRAND_GREEN, paintPageBackground } from '../utils/pdfLetterhead.js';

// totalArea − approvedArea on floats accumulated across many measurements
// produces artifacts like 21.300000000000001 — round for display/storage.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/*
 * Everything here is computed fresh on every call — nothing is stored.
 * Same anti-drift rule already used for current-stock, Receivables, and
 * Payables elsewhere in this codebase.
 *
 * Earnings only count "Approved" area — the portion of a Work that's
 * actually been REVIEWED (financeWorkReview, via WorkReviewPanel in
 * Receivables/Payables) — not merely logged, and no longer tied to
 * whether the client has been billed yet either (review is what unlocks
 * earnings now; billing the client is a separate, later step). Review is
 * work-level, not per-vendor — when more than one vendor contributes to
 * the same Work, this splits that work's reviewed sqft proportionally to
 * each vendor's own share of the logged (measured) area
 * (splitApprovedAreaByShare), same accepted simplification used
 * everywhere else in this codebase for the identical multi-party problem.
 * Total (every logged sqft, unconditional) is tracked separately per work
 * (completedAreaSqft/totalAmount) alongside Approved
 * (approvedAreaSqft/totals.earnings) — the gap between them is
 * unapprovedAreaSqft/totals.unapprovedAmount ("pending review"), never a
 * separately entered figure. This means Balance Payable can go negative:
 * if a contractor's already been paid more than their currently-reviewed
 * work earns (routine right after this feature ships, since historical
 * work was never reviewed), that's "Extra Paid," not a balance due — the
 * frontend is responsible for that framing, this endpoint just reports
 * the signed number.
 *
 * Balance Payable = Approved Earnings − Advances − Deductions − Payments.
 *
 * INTERPRETATION FLAG: the source structure doc gives this as shorthand
 * ("Advance − Expense Given − Deductions = Balance Payable"). This is the
 * one place that formula lives — everything else (Payables' Contractor
 * tab, the Contractors page Ledger/Settlements tabs, and the downloadable
 * Contractor Payment Statement PDF) just reads this function, so adjust
 * only here if that interpretation turns out wrong.
 */
const computeContractorLedger = async (vendorId, projectId) => {
    const vendor = await assertContractorVendor(vendorId);

    const assignments = await FinanceWorkContractorAssignment.find({ contractorVendorId: vendorId, deleted: { $ne: true } });
    const workIds = assignments.map(a => a.workId);

    const workFilter = { _id: { $in: workIds }, deleted: { $ne: true } };
    if (projectId) workFilter.projectId = projectId;
    const works = await FinanceWork.find(workFilter).sort({ createdAt: -1 });

    const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
    const projects = await FinanceProject.find({ _id: { $in: projectIds } });
    const projectNameById = new Map(projects.map(p => [p._id.toString(), p.name]));

    const rates = await FinanceContractorRate.find({
        projectId: { $in: projectIds }, contractorVendorId: vendorId, deleted: { $ne: true },
    });
    const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r]));

    // Earnings are measurement-level, restricted to measurements this
    // vendor actually did — a Work can have another contractor on it
    // too. Rows are seeded at zero for every Work this vendor is
    // assigned to (so a brand-new Work with no measurements yet still
    // shows up), then filled in from measurements.
    const areaByWork = new Map(); // workId -> { totalArea, allVendorsArea }
    for (const w of works) areaByWork.set(w._id.toString(), { totalArea: 0, allVendorsArea: 0 });

    const [measurements, allVendorMeasurements, approvedBillingByWorkId] = await Promise.all([
        works.length
            ? FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, contractorVendorId: vendorId, deleted: { $ne: true } })
                .populate('workId', 'workType')
                .sort({ date: -1 })
            : [],
        // Every contractor's measurements on these works (any vendor) —
        // needed to proportionally split a work's reviewed area when more
        // than one vendor contributes to it (see splitApprovedAreaByShare).
        works.length
            ? FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId areaCoveredSqft')
            : [],
        works.length ? getApprovedBillingByWorkId(works.map(w => w._id)) : new Map(),
    ]);
    for (const m of allVendorMeasurements) {
        const key = m.workId.toString();
        const cur = areaByWork.get(key) || { totalArea: 0, allVendorsArea: 0 };
        cur.allVendorsArea += m.areaCoveredSqft;
        areaByWork.set(key, cur);
    }
    for (const m of measurements) {
        const workKey = m.workId._id.toString();
        const cur = areaByWork.get(workKey) || { totalArea: 0, allVendorsArea: 0 };
        cur.totalArea += m.areaCoveredSqft;
        areaByWork.set(workKey, cur);
    }

    let earningsTotal = 0;
    let totalAmountTotal = 0;
    let unapprovedAmountTotal = 0;
    const worksOut = [];
    for (const w of works) {
        const workKey = w._id.toString();
        const { totalArea, allVendorsArea } = areaByWork.get(workKey);
        const rate = rateByKey.get(`${w.projectId}_${w.workType}`);
        const rateValue = rate ? rate.ratePerSqft : 0;
        const workApprovedBilling = approvedBillingByWorkId.get(workKey) || { areaSqft: 0, date: null };
        const approvedArea = splitApprovedAreaByShare(workApprovedBilling.areaSqft, totalArea, allVendorsArea);
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

    const moneyFilter = { vendorId, deleted: { $ne: true } };
    if (projectId) moneyFilter.projectId = projectId;
    const [advances, deductions, payments] = await Promise.all([
        FinanceContractorAdvance.find(moneyFilter).sort({ date: -1 }),
        FinanceContractorDeduction.find(moneyFilter).sort({ date: -1 }),
        FinanceContractorPayment.find(moneyFilter).populate('bankAccountId', 'accountName').populate('tdsSectionId', 'name code').sort({ date: -1 }),
    ]);

    const advancesTotal = advances.reduce((sum, a) => sum + a.amount, 0);
    const deductionsTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
    const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    earningsTotal = round2(earningsTotal);
    totalAmountTotal = round2(totalAmountTotal);
    unapprovedAmountTotal = round2(unapprovedAmountTotal);
    const balancePayable = round2(earningsTotal - advancesTotal - deductionsTotal - paymentsTotal);

    return {
        vendor,
        vendorId: vendor._id, vendorName: vendor.name,
        works: worksOut, measurements, advances, deductions, payments,
        totals: {
            earnings: earningsTotal, totalAmount: totalAmountTotal, unapprovedAmount: unapprovedAmountTotal,
            advances: advancesTotal, deductions: deductionsTotal, payments: paymentsTotal, balancePayable,
        },
    };
};

const getContractorLedger = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { projectId } = req.query;
        const { vendor, ...data } = await computeContractorLedger(vendorId, projectId);
        res.json({ success: true, data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error computing contractor ledger' });
    }
};

// Per-project payment statement — same "approved/unapproved sqft, deduct
// advances/deductions/payments down to a balance" data as the on-screen
// Ledger tab, filtered to one project (a bill needs a project scope; the
// ledger endpoint's own cross-project mode stays JSON-only). "Approved"
// here carries the same trust model as the client Bill Statement's own
// footnote already discloses — it means "included in an issued client
// bill," not a separately audited per-measurement sign-off.
const downloadContractorBillStatement = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });

        const { vendor, ...data } = await computeContractorLedger(vendorId, projectId);
        const project = await FinanceProject.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        const workTypeById = new Map(data.works.map(w => [w._id.toString(), w.workType]));

        const company = await FinanceCompanySettings.findOne({ deleted: { $ne: true } })
            .populate('primaryBankAccountId', 'accountName bankName accountNumber ifscCode').lean();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Contractor-Statement-${vendor.name.replace(/[^a-z0-9]+/gi, '-')}-${project.name.replace(/[^a-z0-9]+/gi, '-')}.pdf"`);

        const doc = new PDFDocument({ margin: 50, bufferPages: true });
        doc.pipe(res);
        doc.on('pageAdded', () => paintPageBackground(doc));
        paintPageBackground(doc);

        const { left, right, width } = contentBox(doc);

        await writeLetterhead(doc, 'Contractor Payment Statement', company, `${project.name}  •  ${formatDate(new Date())}`);

        const infoTopY = doc.y;
        const colWidth = (width - 24) / 2;
        const leftBottom = drawInfoBox(doc, left, colWidth, 'Contractor', [
            vendor.name,
            vendor.phone ? `Phone: ${vendor.phone}` : null,
            vendor.gstNumber ? `GSTIN: ${vendor.gstNumber}` : null,
        ], company);
        doc.y = infoTopY;
        const rightBottom = drawInfoBox(doc, left + colWidth + 24, colWidth, 'Project', [
            project.name,
            project.siteLocation,
        ], company);
        doc.y = Math.max(leftBottom, rightBottom) + 8;

        writeSectionHeading(doc, 'Work-wise Breakdown');
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
            .text('Approved sqft reflects work reviewed and confirmed; unapproved sqft has been measured but not yet reviewed.', left, doc.y, { width });
        doc.fillColor('#000000').fontSize(10);
        doc.moveDown(0.6);

        if (data.deductions.length > 0) {
            writeSectionHeading(doc, 'Deductions');
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
            writeSectionHeading(doc, 'Advances');
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
            writeSectionHeading(doc, 'Payments');
            drawTable(doc, {
                company,
                columns: [
                    { label: 'Date', width: 81, align: 'left' },
                    { label: 'Amount', width: 99, align: 'right' },
                    { label: 'Mode', width: 99, align: 'left' },
                    { label: 'UTR / Reference', width: 117, align: 'left' },
                    { label: 'TDS', width: 116, align: 'left' },
                ],
                rows: data.payments.map(p => [
                    formatDate(p.date), formatCurrency(p.amount), p.paymentMode || '—', p.utrNumber || '—',
                    p.tdsAmount ? `${formatCurrency(p.tdsAmount)}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '—',
                ]),
            });
            doc.moveDown(0.4);
        }

        // Totals — same shape as the client Bill Statement's own totals block.
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

        // Balance banner — same convention as ContractorLedgerView.jsx's own
        // totals row: color keys off > 0 (red = owed, a liability), but the
        // "Extra Paid" label specifically keys off < 0 — a zero balance
        // reads as "Balance Payable: Rs. 0" in green, matching that exact
        // (slightly quirky) on-screen behavior rather than inventing a
        // cleaner but inconsistent variant here.
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

        // Bank fields are required:true on financeVendor going forward, but
        // records saved before that constraint existed can still be blank —
        // stay silent rather than print "Account Name: undefined".
        if (vendor.bankName || vendor.accountName || vendor.accountNumber || vendor.ifscCode) {
            drawInfoBox(doc, left, width, 'Pay To', [
                vendor.bankName || null,
                vendor.accountName ? `Account Name: ${vendor.accountName}` : null,
                vendor.accountNumber ? `Account No: ${vendor.accountNumber}` : null,
                vendor.ifscCode ? `IFSC: ${vendor.ifscCode}` : null,
            ], company);
        }

        writeSignatureLine(doc, company);
        writeFooter(doc, company);
        doc.end();
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ success: false, message: err.message || 'Error generating contractor statement PDF' });
    }
};

export { getContractorLedger, downloadContractorBillStatement };
