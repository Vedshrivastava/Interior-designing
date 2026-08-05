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
import { getCategoryApprovedAreaByWorkId, splitApprovedAreaByShare, computeMaterialAvgRates } from './financeReports.js';
import { getWorkerPayoutTotal } from './financeClientDirectPayment.js';
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
 * Balance Payable = Approved Earnings − Advances − Deductions − Material
 * Waste − Direct Pay (from client) − Payments. TDS is NOT its own term
 * here — it's already inside the gross Payments figure (see totals.tdsTotal's
 * own comment below), purely informational everywhere it's surfaced.
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

    const [measurements, allVendorMeasurements, categoryApprovedByWorkId, avgRateEntries, directPaymentTotal] = await Promise.all([
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
        // This vendor's category's own share of each work's combined
        // approved ceiling — see getCategoryApprovedAreaByWorkId's comment
        // (a work's review approves contractor + labour sqft together; this
        // splits that combined figure before it reaches any one vendor).
        works.length ? getCategoryApprovedAreaByWorkId(works.map(w => w._id)) : new Map(),
        // A vendor's works can span multiple projects, unlike Work Detail's
        // single-project scope — each project needs its own weighted-average
        // material rate map (rates are project-scoped, not global).
        Promise.all(projectIds.map(async (pid) => [pid, await computeMaterialAvgRates(pid)])),
        // Flat, not sqft-based — see getWorkerPayoutTotal's comment (an
        // advance, not payment for specific measured work).
        getWorkerPayoutTotal('contractor', vendorId, projectId || undefined),
    ]);
    const avgRateByProject = new Map(avgRateEntries);
    for (const m of allVendorMeasurements) {
        const key = m.workId.toString();
        const cur = areaByWork.get(key) || { totalArea: 0, allVendorsArea: 0 };
        cur.allVendorsArea += m.areaCoveredSqft;
        areaByWork.set(key, cur);
    }
    // Pooled total/total per work, same convention as computeWorkScopedReport's
    // per-vendor materialCostPerSqft — this vendor's own material cost on this
    // work divided by this vendor's own material-tagged area on it.
    const materialCostByWork = new Map();
    const materialAreaByWork = new Map();
    for (const m of measurements) {
        const workKey = m.workId._id.toString();
        const cur = areaByWork.get(workKey) || { totalArea: 0, allVendorsArea: 0 };
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
        const { totalArea, allVendorsArea } = areaByWork.get(workKey);
        const rate = rateByKey.get(`${w.projectId}_${w.workType}`);
        const rateValue = rate ? rate.ratePerSqft : 0;
        const categoryEntry = categoryApprovedByWorkId.get(workKey);
        const contractorApprovedAreaSqft = categoryEntry?.contractorApprovedAreaSqft || 0;
        // A rejection is a FINAL, already-reviewed decision — this vendor's
        // own share of it must not sit in Unapproved forever just because
        // it was never re-labeled Approved. See getCategoryApprovedAreaByWorkId's
        // header comment. Prefer the exact, deliberate per-vendor
        // attribution from the atomic review's own distribution over the
        // proportional guess whenever it's available.
        const contractorRejectedAreaSqft = categoryEntry?.contractorRejectedAreaSqft || 0;
        const rejectedArea = categoryEntry?.contractorExactRejectedByVendor
            ? (categoryEntry.contractorExactRejectedByVendor.get(vendorId.toString()) || 0)
            : splitApprovedAreaByShare(contractorRejectedAreaSqft, totalArea, allVendorsArea);
        const approvedArea = categoryEntry?.contractorExactRejectedByVendor
            ? round2(totalArea - rejectedArea)
            : splitApprovedAreaByShare(contractorApprovedAreaSqft, totalArea, allVendorsArea);
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

    const moneyFilter = { vendorId, deleted: { $ne: true } };
    if (projectId) moneyFilter.projectId = projectId;
    const [advances, deductions, payments] = await Promise.all([
        FinanceContractorAdvance.find(moneyFilter).populate('bankAccountId', 'accountName').sort({ date: -1 }),
        FinanceContractorDeduction.find(moneyFilter).sort({ date: -1 }),
        FinanceContractorPayment.find(moneyFilter).populate('bankAccountId', 'accountName').populate('tdsSectionId', 'name code').sort({ date: -1 }),
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
    // Flat — see getWorkerPayoutTotal's comment; a separate term from
    // deductionsTotal so a real rejection-deduction and an advance the
    // client already paid this vendor directly never blend together.
    const balancePayable = round2(earningsTotal - advancesTotal - deductionsTotal - materialWasteTotal - paymentsTotal - directPaymentTotal);

    // Pooled total/total across every work this vendor has touched — same
    // convention as the per-work figure above, just not scoped to one work.
    let materialCostTotal = 0, materialAreaTotal = 0;
    for (const cost of materialCostByWork.values()) materialCostTotal += cost;
    for (const area of materialAreaByWork.values()) materialAreaTotal += area;

    return {
        vendor,
        vendorId: vendor._id, vendorName: vendor.name,
        works: worksOut, measurements, advances, deductions, payments,
        totals: {
            earnings: earningsTotal, totalAmount: totalAmountTotal, unapprovedAmount: unapprovedAmountTotal,
            advances: advancesTotal, deductions: deductionsTotal, materialWasteTotal, payments: paymentsTotal,
            // Flat total of client-paid amounts (category flagged "cut from
            // worker payout") — an advance, not tied to specific sqft, so
            // it's its own separate subtractor in balancePayable above, not
            // blended into deductionsTotal. See getWorkerPayoutTotal's
            // comment.
            directPaymentTotal,
            balancePayable,
            materialCostPerSqft: materialAreaTotal > 0 ? materialCostTotal / materialAreaTotal : null,
            // Informational only — already included inside `payments`
            // (paymentsTotal is the gross figure Balance Payable nets
            // against); this just surfaces how much of that was withheld
            // as TDS rather than actually reaching the vendor's hand.
            tdsTotal,
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
            // A Review-sourced deduction's Amount is already reflected in
            // Approved Earnings above (see getCategoryApprovedAreaByWorkId's
            // own comment) — only a Manual row's Amount is separately
            // subtracted in the Deductions total below, so this list's own
            // Amount column won't sum to that total whenever both kinds are
            // present. Material Waste is different — always an additional,
            // real deduction, on its own line in the Totals box below. Same
            // explanation ContractorLedgerView.jsx gives on screen.
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

        // TDS Breakdown — comes before the Totals summary below on purpose:
        // this is still "detail" (which payments carried TDS, and where it
        // went), same tier as the Payments table right above it, not part
        // of the final Approved-Earnings-to-Balance-Payable roll-up.
        // Informational only — already inside Payments below (the gross
        // figure Balance Payable nets against); this just states how much
        // of it was withheld rather than paid directly. Grouped by section
        // the same shape computeCaMonthlyPackage already uses for its own
        // TDS Summary.
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

        // Totals — one tier, matching computeContractorLedger's own
        // balancePayable formula exactly (earnings − advances − deductions
        // − materialWaste − directPayment − payments), so the printed
        // lines always foot to the banner below by construction instead of
        // needing to independently re-derive and hope it matches.
        //
        // BUG FIX: this used to run TDS through a second, separate
        // "Subtotal (before TDS) → TDS Withheld → Net Payable (after TDS)"
        // tier, subtracting tdsTotal a second time from a subtotal that
        // hadn't even had Payments applied yet. But paymentsTotal (used in
        // balancePayable, and in the single Payments line below) is
        // already the GROSS pre-TDS amount — tdsTotal is explicitly
        // documented on computeContractorLedger's own totals object as
        // "informational only... already included inside payments." Actually
        // subtracting it again double-counted it, and every line here used
        // to print Math.abs(value) with no sign at all, so a reader had no
        // way to notice the running total had gone negative — a contractor
        // paid more than tdsTotal beyond what they'd earned could see a
        // "Net Payable (after TDS)" figure that was actually more negative
        // than "Subtotal (before TDS)," reading as if TDS had been ADDED.
        // TDS now stays exactly where the TDS Breakdown table above (and
        // this endpoint's own totals comment) already say it belongs:
        // informational only, never part of this arithmetic.
        const totalsBoxWidth = 260;
        const totalsX = right - totalsBoxWidth;
        const labelWidth = 150;
        const valueWidth = totalsBoxWidth - labelWidth;
        let ty = doc.y;
        // subtract:true prefixes a minus sign against the always-positive
        // absValue — same convention the on-screen Ledger/Dashboard
        // breakdowns already use (buildBreakdownSub) — rather than relying
        // on formatCurrency to render a negative number, which put the
        // "Rs." before the sign ("Rs. -20,000") instead of after it. Plain
        // ASCII hyphen, not the on-screen "−" (U+2212) — PDFKit's built-in
        // Helvetica uses WinAnsiEncoding, which has no glyph for U+2212 and
        // silently substitutes a completely different character (a " ditto
        // mark) instead — confirmed by actually rendering this PDF to an
        // image and looking at it, not just reading the source.
        const totalsLine = (label, absValue, subtract = false, bold = false) => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
            doc.text(label, totalsX, ty, { width: labelWidth });
            doc.text(`${subtract ? '- ' : ''}${formatCurrency(absValue)}`, totalsX + labelWidth, ty, { width: valueWidth, align: 'right' });
            ty += bold ? 18 : 16;
        };
        totalsLine('Approved Earnings', data.totals.earnings);
        totalsLine('Advances', data.totals.advances, true);
        totalsLine('Deductions', data.totals.deductions, true);
        if (data.totals.materialWasteTotal > 0) totalsLine('Material Waste', data.totals.materialWasteTotal, true);
        if (data.totals.directPaymentTotal > 0) totalsLine('Direct Pay (from Client)', data.totals.directPaymentTotal, true);
        totalsLine('Payments', data.totals.payments, true);
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
        if (data.totals.tdsTotal > 0) {
            doc.fontSize(8).fillColor('#888888')
                .text(`TDS: of the Rs. ${data.totals.payments.toLocaleString('en-IN')} in Payments above, Rs. ${(data.totals.payments - data.totals.tdsTotal).toLocaleString('en-IN')} was paid to you in cash and Rs. ${data.totals.tdsTotal.toLocaleString('en-IN')} was withheld and deposited with the tax department on your behalf (see TDS Breakdown above) — already counted in full above, not a further deduction.`, left, doc.y, { width });
            doc.fillColor('#000000').fontSize(10);
            doc.moveDown(0.4);
        }

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
        doc.y = bannerY + bannerH + 4;

        // Extra Paid breakdown — mirrors the on-screen ledger's extraPaidSub
        // (DashboardWidgets.jsx) exactly, so the PDF and the app never tell a
        // different story: who actually overpaid (the company itself, via
        // advances/payments, vs the client direct) against net earnings. Paid
        // by Us stays gross for the same reason the Totals block above does —
        // TDS withheld still discharged the debt, just via the tax department
        // instead of cash in hand — the parenthetical only clarifies the split.
        if (balancePayable < 0) {
            const paidByUs = round2((data.totals.advances || 0) + (data.totals.payments || 0));
            const paidByClient = round2(data.totals.directPaymentTotal || 0);
            const netEarned = Math.max(0, round2((data.totals.earnings || 0) - (data.totals.deductions || 0) - (data.totals.materialWasteTotal || 0)));
            const paidByUsNote = data.totals.tdsTotal > 0
                ? ` (Rs. ${(paidByUs - data.totals.tdsTotal).toLocaleString('en-IN')} cash + Rs. ${data.totals.tdsTotal.toLocaleString('en-IN')} TDS)`
                : '';
            doc.fontSize(8).fillColor('#888888')
                .text(`Made up of: Paid by Us Rs. ${paidByUs.toLocaleString('en-IN')}${paidByUsNote} + Paid by Client Rs. ${paidByClient.toLocaleString('en-IN')} - Earned Rs. ${netEarned.toLocaleString('en-IN')}.`, left, doc.y, { width });
            doc.fillColor('#000000').fontSize(10);
        }
        doc.moveDown(1);

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
