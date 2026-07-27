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
import { getCategoryApprovedAreaByWorkId, splitApprovedAreaByShare, computeMaterialAvgRates } from './financeReports.js';
import { getWorkerPayoutTotal } from './financeClientDirectPayment.js';
import PDFDocument from 'pdfkit';
import { writeLetterhead, writeSectionHeading, writeSignatureLine, writeFooter, drawInfoBox, drawTable, contentBox, formatCurrency, formatDate, BRAND_GREEN, paintPageBackground } from '../utils/pdfLetterhead.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/*
 * Mirrors computeContractorLedger. Earnings only count "Approved" area —
 * the portion of a Work that's actually been REVIEWED (financeWorkReview,
 * via WorkReviewPanel) — not merely logged, and no longer tied to whether
 * the client has been billed yet either. Review is work-level, not
 * per-labourer — when more than one labourer contributes to the same
 * Work, this splits that work's reviewed sqft proportionally to each
 * labourer's own share of the logged area (splitApprovedAreaByShare).
 * Total (every logged sqft, unconditional) is tracked alongside it per
 * work; the gap is unapprovedAreaSqft/unapprovedAmount ("pending
 * review"), never a separately entered figure. Actual deductions
 * (financeLabourDeduction) are a separate line item entirely — a real
 * ₹/sqft debit against this specific labourer, entered in Payables once a
 * work's rejected pool is attributed to whoever's responsible — not the
 * same thing as a work simply not being reviewed yet.
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

    const [measurements, allLabourerMeasurements, categoryApprovedByWorkId, avgRateEntries, directPaymentTotal] = await Promise.all([
        works.length
            ? FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, labourerId, deleted: { $ne: true } })
                .populate('workId', 'workType')
                .sort({ date: -1 })
            : [],
        // Every labourer's measurements on these works — needed to
        // proportionally split a work's reviewed area when more than one
        // labourer contributes to it (see splitApprovedAreaByShare).
        works.length
            ? FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId areaCoveredSqft')
            : [],
        // This labourer's category's own share of each work's combined
        // approved ceiling — see getCategoryApprovedAreaByWorkId's comment.
        works.length ? getCategoryApprovedAreaByWorkId(works.map(w => w._id)) : new Map(),
        // A labourer's works can span multiple projects — each project needs
        // its own weighted-average material rate map (see the identical
        // comment in financeContractorLedger.js).
        Promise.all(projectIds.map(async (pid) => [pid, await computeMaterialAvgRates(pid)])),
        // Flat, not sqft-based — see getWorkerPayoutTotal's comment (an
        // advance, not payment for specific measured work).
        getWorkerPayoutTotal('labour', labourerId, projectId || undefined),
    ]);
    const avgRateByProject = new Map(avgRateEntries);
    for (const m of allLabourerMeasurements) {
        const key = m.workId.toString();
        const cur = areaByWork.get(key) || { totalArea: 0, allLabourersArea: 0 };
        cur.allLabourersArea += m.areaCoveredSqft;
        areaByWork.set(key, cur);
    }
    // Pooled total/total per work — this labourer's own material cost on
    // this work divided by this labourer's own material-tagged area on it.
    const materialCostByWork = new Map();
    const materialAreaByWork = new Map();
    for (const m of measurements) {
        const workKey = m.workId._id.toString();
        const cur = areaByWork.get(workKey) || { totalArea: 0, allLabourersArea: 0 };
        cur.totalArea += m.areaCoveredSqft;
        areaByWork.set(workKey, cur);
        if (m.materialUsed?.length) {
            const avgRate = avgRateByProject.get(m.projectId?.toString()) || new Map();
            const cost = m.materialUsed.reduce((s, u) => s + u.quantity * (avgRate.get(u.materialId.toString()) || 0), 0);
            materialCostByWork.set(workKey, (materialCostByWork.get(workKey) || 0) + cost);
            materialAreaByWork.set(workKey, (materialAreaByWork.get(workKey) || 0) + m.areaCoveredSqft);
        }
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
        const categoryEntry = categoryApprovedByWorkId.get(workKey);
        const labourApprovedAreaSqft = categoryEntry?.labourApprovedAreaSqft || 0;
        // A rejection is a FINAL, already-reviewed decision — this
        // labourer's own share of it must not sit in Unapproved forever
        // just because it was never re-labeled Approved. See
        // getCategoryApprovedAreaByWorkId's header comment. Prefer the
        // exact, deliberate per-labourer attribution from the atomic
        // review's own distribution over the proportional guess whenever
        // it's available.
        const labourRejectedAreaSqft = categoryEntry?.labourRejectedAreaSqft || 0;
        const rejectedArea = categoryEntry?.labourExactRejectedByLabourer
            ? (categoryEntry.labourExactRejectedByLabourer.get(labourerId.toString()) || 0)
            : splitApprovedAreaByShare(labourRejectedAreaSqft, totalArea, allLabourersArea);
        const approvedArea = categoryEntry?.labourExactRejectedByLabourer
            ? round2(totalArea - rejectedArea)
            : splitApprovedAreaByShare(labourApprovedAreaSqft, totalArea, allLabourersArea);
        const unapprovedArea = round2(Math.max(0, totalArea - approvedArea - rejectedArea));
        const totalAmount = round2(rate ? totalArea * rateValue : 0);
        const earnings = round2(rate ? approvedArea * rateValue : 0);
        const unapprovedAmount = round2(rate ? unapprovedArea * rateValue : 0);
        earningsTotal += earnings;
        totalAmountTotal += totalAmount;
        unapprovedAmountTotal += unapprovedAmount;

        const workMaterialArea = materialAreaByWork.get(workKey) || 0;
        worksOut.push({
            _id: w._id,
            projectId: w.projectId, projectName: projectNameById.get(w.projectId.toString()) || '—',
            workType: w.workType,
            estimatedAreaSqft: w.estimatedAreaSqft, completedAreaSqft: round2(totalArea),
            approvedAreaSqft: approvedArea, unapprovedAreaSqft: unapprovedArea,
            approvedDate: approvedArea > 0 ? (categoryEntry?.date || null) : null,
            status: w.status,
            rate: rate ? rate.ratePerSqft : null,
            totalAmount, earnings, unapprovedAmount,
            materialCostPerSqft: workMaterialArea > 0 ? (materialCostByWork.get(workKey) || 0) / workMaterialArea : null,
        });
    }

    const moneyFilter = { labourerId, deleted: { $ne: true } };
    if (projectId) moneyFilter.projectId = projectId;
    const [advances, deductions, payments] = await Promise.all([
        FinanceLabourAdvance.find(moneyFilter).populate('bankAccountId', 'accountName').sort({ date: -1 }),
        FinanceLabourDeduction.find(moneyFilter).sort({ date: -1 }),
        FinanceLabourPayment.find(moneyFilter).populate('bankAccountId', 'accountName').populate('tdsSectionId', 'name code').sort({ date: -1 }),
    ]);

    const advancesTotal = advances.reduce((sum, a) => sum + a.amount, 0);
    // A workReviewCycle-tagged row is the atomic review's own exact
    // rejection attribution — already reflected above via approvedArea, so
    // it must not ALSO reduce Balance Payable again here (would double-
    // count it). It still ships in `deductions` below for a complete
    // history (the frontend labels it "From Review" vs "Manual"), just
    // excluded from this sum — only a genuinely standalone manual
    // deduction (workReviewCycle: null) counts toward the total. See
    // getCategoryApprovedAreaByWorkId's own comment for the full story.
    const deductionsTotal = deductions.filter(d => d.workReviewCycle == null).reduce((sum, d) => sum + d.amount, 0);
    // The material a rejection wasted, priced separately from `amount`
    // above (see the model's own comment) — kept as its own figure rather
    // than folded into deductionsTotal so "Deductions" never silently
    // means two different things depending on which rows exist; Balance
    // Payable below subtracts both explicitly.
    const materialWasteTotal = round2(deductions.reduce((sum, d) => sum + (d.materialWasteAmount || 0), 0));
    const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    const tdsTotal = round2(payments.reduce((sum, p) => sum + (p.tdsAmount || 0), 0));
    earningsTotal = round2(earningsTotal);
    totalAmountTotal = round2(totalAmountTotal);
    unapprovedAmountTotal = round2(unapprovedAmountTotal);
    // Flat — see getWorkerPayoutTotal's comment; kept separate from
    // deductionsTotal so a real rejection-deduction and an advance the
    // client already paid this labourer directly never blend together.
    const balancePayable = round2(earningsTotal - advancesTotal - deductionsTotal - materialWasteTotal - paymentsTotal - directPaymentTotal);

    // Pooled total/total across every work this labourer has touched — same
    // convention as the per-work figure above, just not scoped to one work.
    let materialCostTotal = 0, materialAreaTotal = 0;
    for (const cost of materialCostByWork.values()) materialCostTotal += cost;
    for (const area of materialAreaByWork.values()) materialAreaTotal += area;

    return {
        labourer,
        labourerId: labourer._id, labourerName: labourer.name,
        works: worksOut, measurements, advances, deductions, payments,
        totals: {
            earnings: earningsTotal, totalAmount: totalAmountTotal, unapprovedAmount: unapprovedAmountTotal,
            advances: advancesTotal, deductions: deductionsTotal, materialWasteTotal, payments: paymentsTotal,
            // Flat total of client-paid amounts (category flagged "cut from
            // worker payout") — see getWorkerPayoutTotal's comment; its own
            // term in balancePayable above, not blended into deductionsTotal.
            directPaymentTotal,
            balancePayable,
            materialCostPerSqft: materialAreaTotal > 0 ? materialCostTotal / materialAreaTotal : null,
            // See financeContractorLedger.js's identical comment.
            tdsTotal,
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

// Per-project payment statement — mirrors downloadContractorBillStatement,
// including the TDS column/breakdown now that financeLabourPayment carries
// tdsSectionId/tdsAmount too. No GSTIN line still applies (individual
// labourers aren't GST entities), and no UTR column (financeLabourPayment
// has no utrNumber field, unlike Contractor Payment).
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
                rowHeight: 28, headerHeight: 26,
                columns: [
                    { label: 'Date', width: 78, align: 'left' },
                    { label: 'Work', width: 70, align: 'left' },
                    { label: 'Sqft', width: 38, align: 'right' },
                    { label: 'Amount', width: 62, align: 'right' },
                    { label: 'Mat. Waste', width: 74, align: 'right' },
                    { label: 'Source', width: 50, align: 'left' },
                    { label: 'Reason', width: 140, align: 'left' },
                ],
                rows: data.deductions.map(d => [
                    formatDate(d.date),
                    workTypeById.get((d.workId?._id || d.workId)?.toString()) || '—',
                    d.areaSqft ?? '—',
                    formatCurrency(d.amount),
                    d.materialWasteAmount > 0 ? formatCurrency(d.materialWasteAmount) : '—',
                    d.workReviewCycle != null ? 'Review' : 'Manual',
                    d.reason || '—',
                ]),
            });
            // See downloadContractorBillStatement's identical comment/block.
            if (data.deductions.some(d => d.workReviewCycle != null)) {
                doc.fontSize(8).fillColor('#888888')
                    .text('Review-sourced rows: Amount is already reflected in Approved Earnings above (only Manual rows\' Amount is subtracted again in Deductions below); Material Waste, if any, is always an additional deduction on top.', left, doc.y, { width });
                doc.fillColor('#000000').fontSize(10);
            }
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
                    { label: 'Account', width: 117, align: 'left' },
                    { label: 'TDS', width: 116, align: 'left' },
                ],
                rows: data.payments.map(p => [
                    formatDate(p.date), formatCurrency(p.amount), p.paymentMode || '—', p.bankAccountId?.accountName || 'Cash',
                    p.tdsAmount ? `${formatCurrency(p.tdsAmount)}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '—',
                ]),
            });
            doc.moveDown(0.4);
        }

        // TDS Breakdown — see downloadContractorBillStatement's identical
        // block/comment on why this now comes before the Totals summary
        // below (still "detail," same tier as the Payments table above it).
        if (data.totals.tdsTotal > 0) {
            const tdsBySection = new Map();
            for (const p of data.payments) {
                if (!p.tdsAmount) continue;
                const key = p.tdsSectionId?._id?.toString() || 'unspecified';
                const label = p.tdsSectionId?.name || 'Unspecified section';
                const cur = tdsBySection.get(key) || { label, total: 0 };
                cur.total += p.tdsAmount;
                tdsBySection.set(key, cur);
            }
            writeSectionHeading(doc, 'TDS Breakdown');
            drawTable(doc, {
                company,
                columns: [
                    { label: 'Section', width: 320, align: 'left' },
                    { label: 'TDS Withheld', width: 100, align: 'right' },
                ],
                rows: [...tdsBySection.values()].map(s => [s.label, formatCurrency(s.total)]),
            });
            doc.font('Helvetica').fontSize(10);
            doc.moveDown(0.8);
        }

        // Totals — see downloadContractorBillStatement's identical
        // comment/block for the full reasoning behind this ordering
        // (Approved Earnings down through Direct Pay settle into one Net
        // Payable subtotal, THEN Payments already made are subtracted from
        // that to reach the Balance Payable banner below).
        const totalsBoxWidth = 260;
        const totalsX = right - totalsBoxWidth;
        const labelWidth = 150;
        const valueWidth = totalsBoxWidth - labelWidth;
        let ty = doc.y;
        const totalsLine = (label, value, bold = false) => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
            doc.text(label, totalsX, ty, { width: labelWidth });
            doc.text(formatCurrency(Math.abs(value)), totalsX + labelWidth, ty, { width: valueWidth, align: 'right' });
            ty += bold ? 18 : 16;
        };
        totalsLine('Approved Earnings', data.totals.earnings);
        totalsLine('Advances', -data.totals.advances);
        totalsLine('Deductions', -data.totals.deductions);
        if (data.totals.materialWasteTotal > 0) totalsLine('Material Waste', -data.totals.materialWasteTotal);
        if (data.totals.directPaymentTotal > 0) totalsLine('Direct Pay (from Client)', -data.totals.directPaymentTotal);
        doc.moveTo(totalsX, ty).lineTo(right, ty).strokeColor(BRAND_GREEN).lineWidth(1).stroke();
        ty += 6;
        const subtotalBeforeTds = round2(data.totals.earnings - data.totals.advances - data.totals.deductions - data.totals.materialWasteTotal - data.totals.directPaymentTotal);
        // See downloadContractorBillStatement's identical comment: TDS is
        // cut from the subtotal owed, not from a single payment's gross
        // amount, so it belongs in this roll-up, not as a disconnected
        // side note above it.
        if (data.totals.tdsTotal > 0) {
            totalsLine('Subtotal (before TDS)', subtotalBeforeTds, true);
            totalsLine('TDS Withheld', -data.totals.tdsTotal);
            doc.moveTo(totalsX, ty).lineTo(right, ty).strokeColor(BRAND_GREEN).lineWidth(1).stroke();
            ty += 6;
            const netPayable = round2(subtotalBeforeTds - data.totals.tdsTotal);
            totalsLine('Net Payable (after TDS)', netPayable, true);
            totalsLine('Payments (net, after TDS)', -(data.totals.payments - data.totals.tdsTotal));
        } else {
            totalsLine('Net Payable', subtotalBeforeTds, true);
            totalsLine('Payments', -data.totals.payments);
        }
        doc.moveTo(totalsX, ty).lineTo(right, ty).strokeColor(BRAND_GREEN).lineWidth(1).stroke();
        ty += 6;
        doc.font('Helvetica').fontSize(10);
        doc.y = ty + 10;
        if (data.totals.directPaymentTotal > 0) {
            doc.fontSize(8).fillColor('#888888')
                .text('Direct Pay: amounts the client paid you straight, bypassing the company — already counted as settled above.', left, doc.y, { width });
            doc.fillColor('#000000').fontSize(10);
            doc.moveDown(0.4);
        }

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
