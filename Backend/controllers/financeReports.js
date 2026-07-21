import mongoose from 'mongoose';
import FinanceProject from '../models/financeProject.js';
import FinanceClient from '../models/financeClient.js';
import FinanceVendor from '../models/financeVendor.js';
import FinanceWork from '../models/financeWork.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceContractorRate from '../models/financeContractorRate.js';
import FinanceWorkContractorAssignment from '../models/financeWorkContractorAssignment.js';
import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import FinanceRunningBill from '../models/financeRunningBill.js';
import FinancePurchase from '../models/financePurchase.js';
import FinanceStockMovement from '../models/financeStockMovement.js';
import { computeCurrentStock } from './financeStockMovement.js';
import FinanceMaterial from '../models/financeMaterial.js';
import FinanceReceipt from '../models/financeReceipt.js';
import FinanceExpense from '../models/financeExpense.js';
import FinanceContractorAdvance from '../models/financeContractorAdvance.js';
import FinanceContractorDeduction from '../models/financeContractorDeduction.js';
import FinanceLabourDeduction from '../models/financeLabourDeduction.js';
import FinanceSupervisorDeduction from '../models/financeSupervisorDeduction.js';
import FinanceContractorPayment from '../models/financeContractorPayment.js';
import FinanceVendorPayment from '../models/financeVendorPayment.js';
import FinanceSalaryPayment from '../models/financeSalaryPayment.js';
import FinanceCommissionPayment from '../models/financeCommissionPayment.js';
import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import FinanceLabourRate from '../models/financeLabourRate.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import FinanceLabourAdvance from '../models/financeLabourAdvance.js';
import FinanceLabourPayment from '../models/financeLabourPayment.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceWorkReview from '../models/financeWorkReview.js';
import { summarizeProject } from './financeReceivable.js';
import FinanceSetting from '../models/financeSetting.js';
import FinanceBankAccount from '../models/financeBankAccount.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import FinanceActivityLog from '../models/financeActivityLog.js';
import { getAccountActivity } from './financeBankAccount.js';
import PDFDocument from 'pdfkit';
import { writeLetterhead, writeSectionHeading, writeFooter, formatCurrency, formatDate, paintPageBackground } from '../utils/pdfLetterhead.js';
import FinanceCompanySettings from '../models/financeCompanySettings.js';

// totalArea − approvedArea on floats accumulated across many measurements
// produces artifacts like 21.300000000000001 — round for display/storage.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// .lean() — spreading a hydrated Mongoose document ({ ...doc }) silently
// drops some schema fields (companyName among them), since document
// instances aren't plain objects. A lean query avoids that footgun.
const getCompanyForPdf = async () => (await FinanceCompanySettings.findOne({ deleted: { $ne: true } }).lean()) || null;

// Advance-contract projects bill via Running Bills too, once work starts.
const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material', 'advance'];

/*
 * Reports is a pure rollup layer — every endpoint here is read-only,
 * nothing is stored, nothing broadcasts over WebSocket (there's no data
 * to push; it's pulled on demand). Everything is computed fresh from the
 * same underlying collections every other module already writes to.
 *
 * COSTING METHOD: there's no FIFO/batch-level costing anywhere in this
 * system — purchases and consumption aren't linked batch-to-batch. Every
 * material cost figure below uses weighted-average costing:
 *
 *   Average Rate (per material, per project) =
 *     (SUM(purchase totalAmount) − SUM(return totalAmount))
 *     ÷ (SUM(purchase quantity) − SUM(return quantity))
 *
 *   Consumed Material Cost = SUM(consume-type stock movement quantity) × Average Rate
 *
 * This is an approximation, not an exact cost — the frontend labels every
 * figure derived from it accordingly.
 */

// Shared by Project Profit, Client Profit, Work Profit, and Material
// Analysis — average purchase rate per material within one project.
const computeMaterialAvgRates = async (projectId) => {
    const purchases = await FinancePurchase.find({ projectId, deleted: { $ne: true } });
    const byMaterial = new Map();
    for (const p of purchases) {
        const key = p.materialId.toString();
        if (!byMaterial.has(key)) byMaterial.set(key, { qty: 0, amt: 0 });
        const m = byMaterial.get(key);
        const sign = p.transactionType === 'return' ? -1 : 1;
        m.qty += sign * p.quantity;
        m.amt += sign * p.totalAmount;
    }
    const avgRate = new Map();
    for (const [materialId, m] of byMaterial) avgRate.set(materialId, m.qty > 0 ? m.amt / m.qty : 0);
    return avgRate;
};

const computeProjectMaterialCost = async (projectId) => {
    const avgRate = await computeMaterialAvgRates(projectId);
    const consumed = await FinanceStockMovement.aggregate([
        { $match: { projectId: new mongoose.Types.ObjectId(projectId), movementType: 'consume', deleted: { $ne: true } } },
        { $group: { _id: '$materialId', qty: { $sum: '$quantity' } } },
    ]);
    let total = 0;
    for (const row of consumed) total += row.qty * (avgRate.get(row._id.toString()) || 0);
    return total;
};

// Work-level material cost scopes the same per-project average rate down
// to only this work's consumed quantity — consume movements don't carry
// workId directly, so this traces through relatedMeasurementId → the
// measurement's own workId (see financeStockMovement.js's schema comment).
const computeWorkMaterialCost = async (projectId, workId) => {
    const avgRate = await computeMaterialAvgRates(projectId);
    const measurementIds = (await FinanceMeasurement.find({ workId, deleted: { $ne: true } }, '_id')).map(m => m._id);
    if (!measurementIds.length) return 0;
    const consumed = await FinanceStockMovement.aggregate([
        { $match: { relatedMeasurementId: { $in: measurementIds }, movementType: 'consume', deleted: { $ne: true } } },
        { $group: { _id: '$materialId', qty: { $sum: '$quantity' } } },
    ]);
    let total = 0;
    for (const row of consumed) total += row.qty * (avgRate.get(row._id.toString()) || 0);
    return total;
};

// Measurement-level: each day's area attributes to whichever contractor
// vendor actually did it (a Work can have more than one contractor
// contributing). Contractor cost = only engineer-approved area —
// unapproved measurements aren't a confirmed payable liability yet, same
// gate financeRunningBill applies for client billing (see
// financeContractorLedger.js's header note).
// Cost = only sqft actually billed to the client (an issued running bill's
// lineItems), not everything logged — see computeWorkApprovedBilling's
// header comment for why this replaced the old engineerApproved filter.
// Attribution follows the same "whichever type is present on this work"
// rule as computeWorkExpectedPay; a work with genuinely both a contractor
// and labour presence counts in both this and computeProjectLabourCost
// (same accepted simplification as the rest of this module).
// Returns { approvedAmount, totalAmount } — approvedAmount is what actually
// feeds Profit (project-level cost); totalAmount is every logged sqft's
// worth, unconditional, so views can show both side by side (same pattern
// as everywhere else in this module).
const computeProjectContractorCost = async (projectId) => {
    const works = await FinanceWork.find({ projectId, deleted: { $ne: true } });
    if (!works.length) return { approvedAmount: 0, totalAmount: 0 };

    const [contractorMeasurements, contractorAssignments, bills] = await Promise.all([
        FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId contractorVendorId areaCoveredSqft'),
        FinanceWorkContractorAssignment.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId contractorVendorId'),
        FinanceRunningBill.find({ projectId, status: 'issued', deleted: { $ne: true } }, 'lineItems'),
    ]);
    const vendorIdsByWork = new Map(); // workId -> Set(vendorId)
    const totalAreaByWorkVendor = new Map(); // `${workId}_${vendorId}` -> area
    for (const m of [...contractorMeasurements, ...contractorAssignments]) {
        if (!m.contractorVendorId) continue;
        const key = m.workId.toString();
        if (!vendorIdsByWork.has(key)) vendorIdsByWork.set(key, new Set());
        vendorIdsByWork.get(key).add(m.contractorVendorId.toString());
    }
    for (const m of contractorMeasurements) {
        if (!m.contractorVendorId) continue;
        const key = `${m.workId}_${m.contractorVendorId}`;
        totalAreaByWorkVendor.set(key, (totalAreaByWorkVendor.get(key) || 0) + m.areaCoveredSqft);
    }
    const contractorWorks = works.filter(w => vendorIdsByWork.has(w._id.toString()));
    if (!contractorWorks.length) return { approvedAmount: 0, totalAmount: 0 };

    const approvedAreaByWork = new Map();
    for (const bill of bills) {
        for (const li of bill.lineItems) {
            const key = li.workId.toString();
            approvedAreaByWork.set(key, (approvedAreaByWork.get(key) || 0) + li.areaBilledSqft);
        }
    }

    const allVendorIds = [...new Set(contractorWorks.flatMap(w => [...(vendorIdsByWork.get(w._id.toString()) || [])]))];
    const rates = await FinanceContractorRate.find({ projectId, contractorVendorId: { $in: allVendorIds }, deleted: { $ne: true } });
    const rateByKey = new Map(rates.map(r => [`${r.contractorVendorId}_${r.workType}`, r.ratePerSqft]));

    let approvedAmount = 0;
    let totalAmount = 0;
    for (const work of contractorWorks) {
        const workApprovedArea = approvedAreaByWork.get(work._id.toString()) || 0;
        const vendorIds = [...vendorIdsByWork.get(work._id.toString())];
        const workTotalArea = vendorIds.reduce((s, id) => s + (totalAreaByWorkVendor.get(`${work._id}_${id}`) || 0), 0);
        for (const vendorId of vendorIds) {
            const rate = rateByKey.get(`${vendorId}_${work.workType}`);
            if (!rate) continue;
            const totalArea = totalAreaByWorkVendor.get(`${work._id}_${vendorId}`) || 0;
            totalAmount += totalArea * rate;
            // Split this work's approved (billed) area proportionally to
            // each vendor's own share of the logged area — same reasoning
            // as splitApprovedAreaByShare, inlined here since rates are
            // looked up per (vendor, workType) not per work.
            const approvedArea = workTotalArea > 0 ? workApprovedArea * (totalArea / workTotalArea) : 0;
            approvedAmount += approvedArea * rate;
        }
    }
    return { approvedAmount: round2(approvedAmount), totalAmount: round2(totalAmount) };
};

// Mirrors computeProjectContractorCost, at individual-labourer granularity.
// Labour never had an engineerApproved gate (every logged sqft counted
// immediately) — this is the one genuine behavior change: labour cost now
// also only counts reviewed sqft (WorkReviewPanel), same as contractor.
const computeProjectLabourCost = async (projectId) => {
    const works = await FinanceWork.find({ projectId, deleted: { $ne: true } });
    if (!works.length) return { approvedAmount: 0, totalAmount: 0 };

    const [labourMeasurements, labourAssignments, bills] = await Promise.all([
        FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId labourerId areaCoveredSqft'),
        FinanceWorkLabourAssignment.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId labourerId'),
        FinanceRunningBill.find({ projectId, status: 'issued', deleted: { $ne: true } }, 'lineItems'),
    ]);
    const labourerIdsByWork = new Map();
    const totalAreaByWorkLabourer = new Map(); // `${workId}_${labourerId}` -> area
    for (const m of [...labourMeasurements, ...labourAssignments]) {
        const key = m.workId.toString();
        if (!labourerIdsByWork.has(key)) labourerIdsByWork.set(key, new Set());
        labourerIdsByWork.get(key).add(m.labourerId.toString());
    }
    for (const m of labourMeasurements) {
        const key = `${m.workId}_${m.labourerId}`;
        totalAreaByWorkLabourer.set(key, (totalAreaByWorkLabourer.get(key) || 0) + m.areaCoveredSqft);
    }
    const labourWorks = works.filter(w => labourerIdsByWork.has(w._id.toString()));
    if (!labourWorks.length) return { approvedAmount: 0, totalAmount: 0 };

    const approvedAreaByWork = new Map();
    for (const bill of bills) {
        for (const li of bill.lineItems) {
            const key = li.workId.toString();
            approvedAreaByWork.set(key, (approvedAreaByWork.get(key) || 0) + li.areaBilledSqft);
        }
    }

    const allLabourerIds = [...new Set(labourWorks.flatMap(w => [...(labourerIdsByWork.get(w._id.toString()) || [])]))];
    const rates = await FinanceLabourRate.find({ projectId, labourerId: { $in: allLabourerIds }, deleted: { $ne: true } });
    const rateByKey = new Map(rates.map(r => [`${r.labourerId}_${r.workType}`, r.ratePerSqft]));

    let approvedAmount = 0;
    let totalAmount = 0;
    for (const work of labourWorks) {
        const workApprovedArea = approvedAreaByWork.get(work._id.toString()) || 0;
        const labourerIds = [...labourerIdsByWork.get(work._id.toString())];
        const workTotalArea = labourerIds.reduce((s, id) => s + (totalAreaByWorkLabourer.get(`${work._id}_${id}`) || 0), 0);
        for (const labourerId of labourerIds) {
            const rate = rateByKey.get(`${labourerId}_${work.workType}`);
            if (!rate) continue;
            const totalArea = totalAreaByWorkLabourer.get(`${work._id}_${labourerId}`) || 0;
            totalAmount += totalArea * rate;
            const approvedArea = workTotalArea > 0 ? workApprovedArea * (totalArea / workTotalArea) : 0;
            approvedAmount += approvedArea * rate;
        }
    }
    return { approvedAmount: round2(approvedAmount), totalAmount: round2(totalAmount) };
};

const computeProjectCommissionCost = async (project) => {
    if (!project.referralId) return 0;
    // Advance projects have no per-sqft referral math at all — commission is
    // a flat, manually-typed amount (financeProject.referralCommissionAmount,
    // editable any time), read fresh here so Profit/Client Profit move
    // immediately whenever it's changed. With/Without Material keep the
    // usual completedAreaSqft × referralRatePerSqft computation.
    if (project.contractType === 'advance') return project.referralCommissionAmount || 0;
    const works = await FinanceWork.find({ projectId: project._id, deleted: { $ne: true } });
    if (!works.length) return 0;
    const rates = await FinanceWorkTypeRate.find({ projectId: project._id, deleted: { $ne: true } });
    const rateByWorkType = new Map(rates.map(r => [r.workType, r.referralRatePerSqft]));
    let total = 0;
    for (const w of works) total += w.completedAreaSqft * (rateByWorkType.get(w.workType) || 0);
    return total;
};

// Shared by getProjectProfit and getClientProfit/getClientDetail (which sum
// this across every project belonging to a client).
const computeProjectProfit = async (projectId) => {
    const project = await FinanceProject.findOne({ _id: projectId, deleted: { $ne: true } });
    if (!project) return null;

    const [revenueAgg, materialCost, contractorCostInfo, commissionCost, expenseAgg, labourCostInfo] = await Promise.all([
        FinanceRunningBill.aggregate([
            { $match: { projectId: project._id, status: 'issued', deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        computeProjectMaterialCost(project._id),
        computeProjectContractorCost(project._id),
        computeProjectCommissionCost(project),
        FinanceExpense.aggregate([
            { $match: { projectId: project._id, deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        computeProjectLabourCost(project._id),
    ]);

    const revenue = revenueAgg[0]?.total || 0;
    const otherExpenses = expenseAgg[0]?.total || 0;
    // Profit is built off Approved cost (what's actually billed to the
    // client so far) — Total cost (every logged sqft, unconditional) is
    // exposed alongside for context but never subtracted here.
    const contractorCost = contractorCostInfo.approvedAmount;
    const labourCost = labourCostInfo.approvedAmount;
    const profit = revenue - materialCost - contractorCost - commissionCost - otherExpenses - labourCost;

    return {
        projectId: project._id, projectName: project.name, clientId: project.clientId,
        revenue, materialCost, contractorCost, commissionCost, otherExpenses, labourCost, profit,
        totalContractorCost: contractorCostInfo.totalAmount, totalLabourCost: labourCostInfo.totalAmount,
        marginPercent: revenue > 0 ? (profit / revenue) * 100 : 0,
    };
};

// Cumulative completedAreaSqft over time isn't stored anywhere (only the
// current total lives on the work doc) — approximated by bucketing each
// dated FinanceMeasurement into ISO weeks since the project's startDate (or
// its first measurement, if startDate isn't set) and running a cumulative
// sum. Same "measurement dates as the only dated proxy for progress"
// approximation used by the month-scoped company-wide helpers below.
const computeProgressOverTime = async (projectId, startDate) => {
    const measurements = await FinanceMeasurement.find({ projectId, deleted: { $ne: true } }).sort({ date: 1 });
    if (!measurements.length) return [];
    const start = startDate ? new Date(startDate) : new Date(measurements[0].date);

    const byWeek = new Map();
    for (const m of measurements) {
        const diffDays = Math.floor((new Date(m.date) - start) / 86400000);
        const week = Math.max(0, Math.floor(diffDays / 7));
        byWeek.set(week, (byWeek.get(week) || 0) + m.areaCoveredSqft);
    }
    const maxWeek = Math.max(...byWeek.keys());
    let cumulative = 0;
    const series = [];
    for (let w = 0; w <= maxWeek; w++) {
        cumulative += byWeek.get(w) || 0;
        const weekStart = new Date(start.getTime() + w * 7 * 86400000);
        series.push({ week: w, weekStart: weekStart.toISOString().slice(0, 10), completedAreaSqft: cumulative });
    }
    return series;
};

const getProjectProfit = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const data = await computeProjectProfit(projectId);
        if (!data) return res.status(404).json({ success: false, message: 'Project not found' });
        const project = await FinanceProject.findById(projectId, 'startDate');
        data.progressOverTime = await computeProgressOverTime(projectId, project?.startDate);
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing project profit' });
    }
};

const getClientProfit = async (req, res) => {
    try {
        const { clientId } = req.query;
        if (!clientId) return res.status(400).json({ success: false, message: 'clientId is required' });
        const client = await FinanceClient.findOne({ _id: clientId, deleted: { $ne: true } });
        if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

        const projects = await FinanceProject.find({ clientId, deleted: { $ne: true } });
        const perProject = (await Promise.all(projects.map(p => computeProjectProfit(p._id)))).filter(Boolean);

        const totals = perProject.reduce((acc, p) => ({
            revenue: acc.revenue + p.revenue,
            materialCost: acc.materialCost + p.materialCost,
            contractorCost: acc.contractorCost + p.contractorCost,
            commissionCost: acc.commissionCost + p.commissionCost,
            otherExpenses: acc.otherExpenses + p.otherExpenses,
            labourCost: acc.labourCost + p.labourCost,
            totalContractorCost: acc.totalContractorCost + p.totalContractorCost,
            totalLabourCost: acc.totalLabourCost + p.totalLabourCost,
            profit: acc.profit + p.profit,
        }), { revenue: 0, materialCost: 0, contractorCost: 0, commissionCost: 0, otherExpenses: 0, labourCost: 0, totalContractorCost: 0, totalLabourCost: 0, profit: 0 });
        totals.marginPercent = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

        res.json({ success: true, data: { clientId: client._id, clientName: client.name, projects: perProject, totals } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing client profit' });
    }
};

// The sqft of a Work that's actually been REVIEWED — confirmed via the
// WorkReviewPanel (Payables/Receivables → "Deductions"/review tab), not
// merely logged. This is what "Approved" means everywhere in Finance as
// of the review-gate build: reviewing a worker's logged sqft on a Work
// (rejecting bad portions permanently, or marking the rest clean) is what
// actually approves it — being included in an issued client bill is no
// longer the approval act itself (Generate Bill's own ceiling is now
// capped BY this reviewed figure, see computeBillLineItems). Deliberately
// reads financeWorkReview only — never writes to it — so nothing here can
// itself trigger or block a review.
const computeWorkApprovedBilling = async (work) => {
    // Thin single-work wrapper over getApprovedBillingByWorkId (declared
    // below) — one implementation for both, nothing to drift.
    const result = (await getApprovedBillingByWorkId([work._id])).get(work._id.toString()) || { areaSqft: 0, date: null };
    return { approvedAreaSqft: result.areaSqft, approvedDate: result.date };
};

// Bulk sibling of computeWorkApprovedBilling — one query for many works at
// once (a work only ever belongs to one project, so this is safe to call
// across works from different projects too, e.g. one contractor's entire
// portfolio company-wide). Returns Map<workId, { areaSqft, date }> — sums
// every worker's own reviewed ceiling (financeWorkReview.approvedAreaSqft)
// for that Work; date is the most recent lastReviewedAt among them.
const getApprovedBillingByWorkId = async (workIds) => {
    if (!workIds.length) return new Map();
    const reviews = await FinanceWorkReview.find(
        { workId: { $in: workIds } },
        'workId approvedAreaSqft lastReviewedAt'
    );
    const approvedByWorkId = new Map();
    for (const r of reviews) {
        const key = r.workId.toString();
        const cur = approvedByWorkId.get(key) || { areaSqft: 0, date: null };
        cur.areaSqft = round2(cur.areaSqft + r.approvedAreaSqft);
        if (r.lastReviewedAt && (!cur.date || r.lastReviewedAt > cur.date)) cur.date = r.lastReviewedAt;
        approvedByWorkId.set(key, cur);
    }
    return approvedByWorkId;
};

// How much of a Work's sqft has actually made it into an ISSUED client
// bill's lineItems — kept as its own concept, separate from "Approved"
// (now = reviewed, see getApprovedBillingByWorkId above). These two used
// to be the same thing (issuing the bill WAS the approval act); now that
// review happens first and independently, a work can have reviewed sqft
// that hasn't been billed yet — that gap (reviewed − billed) is what
// Generate Bill's own ceiling actually needs, NOT (logged − reviewed),
// which instead means "still pending review" (see computeWorkExpectedPay's
// availableToBillAreaSqft vs unapprovedAreaSqft).
const getBilledAreaByWorkId = async (workIds) => {
    if (!workIds.length) return new Map();
    const bills = await FinanceRunningBill.find(
        { status: 'issued', deleted: { $ne: true }, 'lineItems.workId': { $in: workIds } },
        'billDate lineItems'
    );
    const workIdSet = new Set(workIds.map(id => id.toString()));
    const billedByWorkId = new Map();
    for (const bill of bills) {
        for (const li of bill.lineItems) {
            const key = li.workId.toString();
            if (!workIdSet.has(key)) continue;
            const cur = billedByWorkId.get(key) || { areaSqft: 0, date: null };
            cur.areaSqft += li.areaBilledSqft;
            if (!cur.date || bill.billDate > cur.date) cur.date = bill.billDate;
            billedByWorkId.set(key, cur);
        }
    }
    return billedByWorkId;
};

const computeWorkBilledArea = async (work) => {
    const result = (await getBilledAreaByWorkId([work._id])).get(work._id.toString()) || { areaSqft: 0, date: null };
    return { billedAreaSqft: result.areaSqft, billedDate: result.date };
};

// A running bill's lineItems only record a work-level billed total, never a
// per-contractor/per-labourer split — so when more than one party
// contributes to the same Work, this splits that work's approved sqft
// proportionally to each party's own share of the logged (measured) area.
// Exact for the overwhelmingly common case of one party per Work; the same
// accepted simplification documented on computeWorkExpectedPay/
// computeWorkProfit, now centralized so every earnings site applies it
// identically instead of drifting.
const splitApprovedAreaByShare = (approvedAreaSqft, partyArea, totalAreaAllParties) =>
    totalAreaAllParties > 0 ? round2(approvedAreaSqft * (partyArea / totalAreaAllParties)) : 0;

// "Expected Total Pay" for a Work — a forward-looking figure, deliberately
// separate from computeWorkProfit's contractorCost/labourCost (which are
// backward-looking: actual measured/approved area to date). This instead
// asks "what will this work actually pay out once finished, after
// penalties": rate × estimatedAreaSqft (the full contract target) per
// assigned contractor/labourer, minus every deduction manually entered
// against this specific work (financeContractorDeduction/
// financeLabourDeduction with a matching workId — see those controllers).
// Reuses the exact same rate-lookup-by-(project, party, workType) shape as
// computeWorkProfit so nothing drifts between the two.
//
// KNOWN LIMITATION: if a Work genuinely has more than one contributing
// contractor/labourer, this sums each one's rate × the *full* estimated
// area rather than a real split of who's doing which portion — accepted
// because no data anywhere in this schema records that split (the same
// simplification computeProjectContractorCost's callers already live
// with). Harmless for the common case of one team per Work.
const computeWorkExpectedPay = async (work) => {
    const [contractorAssignments, labourAssignments, contractorMeasurements, labourMeasurements] = await Promise.all([
        FinanceWorkContractorAssignment.find({ workId: work._id, deleted: { $ne: true } }, 'contractorVendorId'),
        FinanceWorkLabourAssignment.find({ workId: work._id, deleted: { $ne: true } }, 'labourerId'),
        FinanceMeasurement.find({ workId: work._id, deleted: { $ne: true } }, 'contractorVendorId'),
        FinanceLabourMeasurement.find({ workId: work._id, deleted: { $ne: true } }, 'labourerId'),
    ]);
    const vendorIds = new Set([
        ...contractorAssignments.map(a => a.contractorVendorId.toString()),
        ...contractorMeasurements.filter(m => m.contractorVendorId).map(m => m.contractorVendorId.toString()),
    ]);
    const labourerIds = new Set([
        ...labourAssignments.map(a => a.labourerId.toString()),
        ...labourMeasurements.map(m => m.labourerId.toString()),
    ]);

    const [contractorRates, labourRates, contractorDeductionAgg, labourDeductionAgg, supervisorDeductionAgg] = await Promise.all([
        vendorIds.size ? FinanceContractorRate.find({ projectId: work.projectId, contractorVendorId: { $in: [...vendorIds] }, workType: work.workType, deleted: { $ne: true } }) : [],
        labourerIds.size ? FinanceLabourRate.find({ projectId: work.projectId, labourerId: { $in: [...labourerIds] }, workType: work.workType, deleted: { $ne: true } }) : [],
        FinanceContractorDeduction.aggregate([
            { $match: { workId: work._id, deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        FinanceLabourDeduction.aggregate([
            { $match: { workId: work._id, deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        // Supervisor deductions don't reduce this Work's own contractor/
        // labour pay (a supervisor is paid salary, not an area rate) — but
        // still count toward this work's overall "money withheld due to
        // negligence" total, since that's the figure this function reports.
        FinanceSupervisorDeduction.aggregate([
            { $match: { workId: work._id, deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);

    const expectedContractorPay = contractorRates.reduce((s, r) => s + work.estimatedAreaSqft * r.ratePerSqft, 0);
    const expectedLabourPay = labourRates.reduce((s, r) => s + work.estimatedAreaSqft * r.ratePerSqft, 0);
    const expectedPay = round2(expectedContractorPay + expectedLabourPay);
    const deductedTotal = round2((contractorDeductionAgg[0]?.total || 0) + (labourDeductionAgg[0]?.total || 0) + (supervisorDeductionAgg[0]?.total || 0));

    // Total = every logged sqft so far (work.completedAreaSqft, unconditional
    // — same figure the dashboard's "show it even before approval" boxes
    // use) × rate. Approved = only the sqft actually reviewed and confirmed
    // (computeWorkApprovedBilling, sourced from financeWorkReview) × the
    // same rate — this, not Total, is what's actually owed to whoever did
    // the work. Unapproved is simply the gap; never a separately entered
    // figure.
    const totalAreaSqft = work.completedAreaSqft;
    const totalAmount = round2(
        contractorRates.reduce((s, r) => s + totalAreaSqft * r.ratePerSqft, 0)
        + labourRates.reduce((s, r) => s + totalAreaSqft * r.ratePerSqft, 0)
    );
    const { approvedAreaSqft, approvedDate } = await computeWorkApprovedBilling(work);
    const approvedAmount = round2(
        contractorRates.reduce((s, r) => s + approvedAreaSqft * r.ratePerSqft, 0)
        + labourRates.reduce((s, r) => s + approvedAreaSqft * r.ratePerSqft, 0)
    );

    // Available to bill = Reviewed − already Billed — deliberately NOT the
    // same gap as unapprovedAreaSqft (Total − Reviewed, "still pending
    // review"). Generate Bill's own ceiling needs this one: sqft that's
    // already been reviewed and confirmed, but hasn't made it into an
    // issued bill yet. Reviewed sqft never disappears once billed (it
    // still counts as this worker's Approved earnings either way) — this
    // figure just tracks how much of it is still available for a *new*
    // bill to draw on.
    const { billedAreaSqft } = await computeWorkBilledArea(work);
    const availableToBillAreaSqft = round2(Math.max(0, approvedAreaSqft - billedAreaSqft));
    const availableToBillAmount = round2(
        contractorRates.reduce((s, r) => s + availableToBillAreaSqft * r.ratePerSqft, 0)
        + labourRates.reduce((s, r) => s + availableToBillAreaSqft * r.ratePerSqft, 0)
    );

    return {
        expectedPay, deductedTotal, expectedPayNetOfDeductions: round2(expectedPay - deductedTotal),
        totalAreaSqft, totalAmount, approvedAreaSqft, approvedAmount, approvedDate,
        unapprovedAreaSqft: round2(totalAreaSqft - approvedAreaSqft), unapprovedAmount: round2(totalAmount - approvedAmount),
        billedAreaSqft, availableToBillAreaSqft, availableToBillAmount,
    };
};

// Shared by getWorkProfit and getWorkDetail (Tier-2 work drill-down) so the
// contractor-cost/revenue/profit numbers can never drift between the two.
//
// INTERPRETATION FLAG: the spec's revenue formula for Work Profit doesn't
// explicitly say to filter by bill status the way Project Profit does. To
// keep "Revenue" meaning the same thing everywhere in this module (money
// actually billed to the client, not a draft that could still change),
// this filters to status: 'issued' too — flip this filter here only if
// that turns out to be the wrong call.
const computeWorkProfit = async (work) => {
    const revenueAgg = await FinanceRunningBill.aggregate([
        { $match: { status: 'issued', deleted: { $ne: true } } },
        { $unwind: '$lineItems' },
        { $match: { 'lineItems.workId': work._id } },
        { $group: { _id: null, amount: { $sum: '$lineItems.amount' }, areaBilledSqft: { $sum: '$lineItems.areaBilledSqft' } } },
    ]);
    const revenue = revenueAgg[0]?.amount || 0;
    const areaBilledSqft = revenueAgg[0]?.areaBilledSqft || 0;

    // Contractor Cost is measurement-level: each day's area attributes to
    // whichever contractor vendor actually did it, so a Work with more than
    // one contributing contractor gets a per-contractor breakdown, not one
    // blended rate. `contractorCost` stays the summed total so nothing
    // reading only that field breaks.
    //
    // Total (areaSqft) is every logged sqft, unconditional — engineerApproved
    // no longer gates anything here (see computeWorkApprovedBilling's header
    // comment: reviewing via WorkReviewPanel is the real gate now). Approved
    // (approvedAreaSqft) is this work's reviewed sqft
    // (computeWorkApprovedBilling), distributed across contributing vendors
    // proportional to each one's share of Total — lineItems only record a
    // work-level billed figure, not a per-vendor split, so this is the best
    // available attribution when more than one vendor's on a work (exact
    // for the common single-vendor case).
    const { approvedAreaSqft: workApprovedAreaSqft, approvedDate: workApprovedDate } = await computeWorkApprovedBilling(work);
    const measurements = await FinanceMeasurement.find({ workId: work._id, deleted: { $ne: true } });
    const areaByVendor = new Map(); // contractorVendorId -> totalArea
    for (const m of measurements) {
        if (!m.contractorVendorId) continue;
        const key = m.contractorVendorId.toString();
        areaByVendor.set(key, (areaByVendor.get(key) || 0) + m.areaCoveredSqft);
    }
    // Seed assigned contractors with zero area too, so a brand-new Work
    // with a contractor assigned but no measurements yet still shows a
    // (zero) breakdown row.
    const assignments = await FinanceWorkContractorAssignment.find({ workId: work._id, deleted: { $ne: true } });
    for (const a of assignments) {
        const key = a.contractorVendorId.toString();
        if (!areaByVendor.has(key)) areaByVendor.set(key, 0);
    }

    let contractorCost = 0;
    const contractorBreakdown = [];
    const totalVendorArea = [...areaByVendor.values()].reduce((s, a) => s + a, 0);
    if (areaByVendor.size) {
        const vendorIds = [...areaByVendor.keys()];
        const [rates, vendors] = await Promise.all([
            FinanceContractorRate.find({ projectId: work.projectId, contractorVendorId: { $in: vendorIds }, workType: work.workType, deleted: { $ne: true } }),
            FinanceVendor.find({ _id: { $in: vendorIds }, deleted: { $ne: true } }),
        ]);
        const rateByVendor = new Map(rates.map(r => [r.contractorVendorId.toString(), r]));
        const vendorById = new Map(vendors.map(v => [v._id.toString(), v]));
        for (const [vendorId, totalArea] of areaByVendor) {
            const rate = rateByVendor.get(vendorId);
            const perUnit = rate ? (rate.ratePerSqft) : 0;
            const approvedArea = splitApprovedAreaByShare(workApprovedAreaSqft, totalArea, totalVendorArea);
            const unapprovedArea = round2(totalArea - approvedArea);
            const totalAmount = round2(totalArea * perUnit);
            const approvedAmount = round2(approvedArea * perUnit);
            contractorCost += approvedAmount;
            const vendor = vendorById.get(vendorId);
            contractorBreakdown.push({
                vendorId, vendorName: vendor?.name || '—',
                areaSqft: round2(totalArea), approvedAreaSqft: approvedArea, unapprovedAreaSqft: unapprovedArea,
                rate: perUnit, totalAmount, approvedAmount, unapprovedAmount: round2(totalAmount - approvedAmount),
                approvedDate: workApprovedDate,
            });
        }
    }

    contractorCost = round2(contractorCost);

    // Labour Cost — same per-person breakdown as contractor above. Labour
    // never had an engineerApproved gate (every logged sqft was immediately
    // payable) — this is the one genuine behavior change: labour earnings
    // now also only count reviewed sqft (WorkReviewPanel). Same proportional
    // distribution of this work's Approved sqft across contributing
    // labourers as the contractor side above.
    const labourMeasurements = await FinanceLabourMeasurement.find({ workId: work._id, deleted: { $ne: true } });
    const areaByLabourer = new Map(); // labourerId -> totalArea
    for (const m of labourMeasurements) {
        const key = m.labourerId.toString();
        areaByLabourer.set(key, (areaByLabourer.get(key) || 0) + m.areaCoveredSqft);
    }
    const labourAssignments = await FinanceWorkLabourAssignment.find({ workId: work._id, deleted: { $ne: true } });
    for (const a of labourAssignments) {
        const key = a.labourerId.toString();
        if (!areaByLabourer.has(key)) areaByLabourer.set(key, 0);
    }

    let labourCost = 0;
    const labourBreakdown = [];
    const totalLabourerArea = [...areaByLabourer.values()].reduce((s, a) => s + a, 0);
    if (areaByLabourer.size) {
        const labourerIds = [...areaByLabourer.keys()];
        const [labourRates, labourers] = await Promise.all([
            FinanceLabourRate.find({ projectId: work.projectId, labourerId: { $in: labourerIds }, workType: work.workType, deleted: { $ne: true } }),
            FinanceLabourer.find({ _id: { $in: labourerIds }, deleted: { $ne: true } }),
        ]);
        const rateByLabourer = new Map(labourRates.map(r => [r.labourerId.toString(), r]));
        const labourerById = new Map(labourers.map(l => [l._id.toString(), l]));
        for (const [labourerId, totalArea] of areaByLabourer) {
            const rate = rateByLabourer.get(labourerId);
            const perUnit = rate ? rate.ratePerSqft : 0;
            const approvedArea = splitApprovedAreaByShare(workApprovedAreaSqft, totalArea, totalLabourerArea);
            const unapprovedArea = round2(totalArea - approvedArea);
            const totalAmount = round2(totalArea * perUnit);
            const approvedAmount = round2(approvedArea * perUnit);
            labourCost += approvedAmount;
            const labourer = labourerById.get(labourerId);
            labourBreakdown.push({
                labourerId, labourerName: labourer?.name || '—',
                areaSqft: round2(totalArea), approvedAreaSqft: approvedArea, unapprovedAreaSqft: unapprovedArea,
                rate: perUnit, totalAmount, approvedAmount, unapprovedAmount: round2(totalAmount - approvedAmount),
                approvedDate: workApprovedDate,
            });
        }
    }
    labourCost = round2(labourCost);

    const materialCost = await computeWorkMaterialCost(work.projectId, work._id);
    const profit = revenue - contractorCost - labourCost - materialCost;
    const {
        expectedPay, deductedTotal, expectedPayNetOfDeductions,
        totalAreaSqft, totalAmount, approvedAreaSqft, approvedAmount, approvedDate, unapprovedAreaSqft, unapprovedAmount,
    } = await computeWorkExpectedPay(work);

    return {
        revenue, contractorCost, contractorBreakdown, labourCost, labourBreakdown, materialCost, profit, areaBilledSqft,
        expectedPay, deductedTotal, expectedPayNetOfDeductions,
        totalAreaSqft, totalAmount, approvedAreaSqft, approvedAmount, approvedDate, unapprovedAreaSqft, unapprovedAmount,
    };
};

// Everything about one Work — area, contractor/labour cost + breakdown,
// material used/wasted, and the daily cost/sqft trend — scoped to one
// date window instead of computeWorkProfit's fixed all-time scope.
// `dateStart`/`dateEnd` are both nullable; null on both means all time,
// only `dateEnd` set means "from the work's start through that date",
// both set means a bounded window (a single day, or a month). Always shows
// 100% of logged area/cost for the window, unconditional — approval is a
// whole-Work, billing-derived snapshot (computeWorkApprovedBilling), not
// something attributable to one specific day or month, so this scoped view
// doesn't attempt an approved/unapproved split at all (that only exists in
// computeWorkProfit's all-time figures).
const computeWorkScopedReport = async (work, { dateStart, dateEnd, avgRate }) => {
    const dateFilter = {};
    if (dateStart) dateFilter.$gte = dateStart;
    if (dateEnd) dateFilter.$lte = dateEnd;
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const [measurements, labourMeasurements, taggedWaste, projectWasteTotal] = await Promise.all([
        FinanceMeasurement.find({ workId: work._id, ...(hasDateFilter ? { date: dateFilter } : {}), deleted: { $ne: true } }).sort({ date: 1 }),
        FinanceLabourMeasurement.find({ workId: work._id, ...(hasDateFilter ? { date: dateFilter } : {}), deleted: { $ne: true } }),
        FinanceStockMovement.aggregate([
            { $match: { workId: work._id, movementType: 'waste', deleted: { $ne: true }, ...(hasDateFilter ? { date: dateFilter } : {}) } },
            { $group: { _id: '$materialId', qty: { $sum: '$quantity' } } },
        ]),
        // Untagged waste at this project — reported separately, honestly,
        // rather than silently folded into or excluded from this work's number.
        FinanceStockMovement.aggregate([
            { $match: { projectId: work.projectId, movementType: 'waste', workId: null, deleted: { $ne: true }, ...(hasDateFilter ? { date: dateFilter } : {}) } },
            { $group: { _id: '$materialId', qty: { $sum: '$quantity' } } },
        ]),
    ]);

    const areaByVendor = new Map();
    for (const m of measurements) {
        if (!m.contractorVendorId) continue;
        const key = m.contractorVendorId.toString();
        areaByVendor.set(key, (areaByVendor.get(key) || 0) + m.areaCoveredSqft);
    }
    let contractorCost = 0;
    const contractorBreakdown = [];
    if (areaByVendor.size) {
        const vendorIds = [...areaByVendor.keys()];
        const [rates, vendors] = await Promise.all([
            FinanceContractorRate.find({ projectId: work.projectId, contractorVendorId: { $in: vendorIds }, workType: work.workType, deleted: { $ne: true } }),
            FinanceVendor.find({ _id: { $in: vendorIds }, deleted: { $ne: true } }),
        ]);
        const rateByVendor = new Map(rates.map(r => [r.contractorVendorId.toString(), r]));
        const vendorById = new Map(vendors.map(v => [v._id.toString(), v]));
        for (const [vendorId, totalArea] of areaByVendor) {
            const perUnit = rateByVendor.get(vendorId)?.ratePerSqft || 0;
            const earnings = round2(totalArea * perUnit);
            contractorCost += earnings;
            contractorBreakdown.push({
                vendorId, vendorName: vendorById.get(vendorId)?.name || '—',
                areaSqft: round2(totalArea), rate: perUnit, earnings,
            });
        }
    }
    contractorCost = round2(contractorCost);

    const areaByLabourer = new Map();
    for (const m of labourMeasurements) {
        const key = m.labourerId.toString();
        areaByLabourer.set(key, (areaByLabourer.get(key) || 0) + m.areaCoveredSqft);
    }
    let labourCost = 0;
    const labourBreakdown = [];
    if (areaByLabourer.size) {
        const labourerIds = [...areaByLabourer.keys()];
        const [labourRates, labourers] = await Promise.all([
            FinanceLabourRate.find({ projectId: work.projectId, labourerId: { $in: labourerIds }, workType: work.workType, deleted: { $ne: true } }),
            FinanceLabourer.find({ _id: { $in: labourerIds }, deleted: { $ne: true } }),
        ]);
        const rateByLabourer = new Map(labourRates.map(r => [r.labourerId.toString(), r]));
        const labourerById = new Map(labourers.map(l => [l._id.toString(), l]));
        for (const [labourerId, totalArea] of areaByLabourer) {
            const perUnit = rateByLabourer.get(labourerId)?.ratePerSqft || 0;
            const earnings = round2(totalArea * perUnit);
            labourCost += earnings;
            labourBreakdown.push({
                labourerId, labourerName: labourerById.get(labourerId)?.name || '—',
                areaSqft: round2(totalArea), rate: perUnit, earnings,
            });
        }
    }
    labourCost = round2(labourCost);

    const areaCoveredSqft = round2(
        [...areaByVendor.values()].reduce((sum, a) => sum + a, 0)
        + [...areaByLabourer.values()].reduce((sum, a) => sum + a, 0)
    );

    // Material Used — traced via each measurement's own materialUsed[],
    // not re-derived from stock movements (measurements already store it).
    const materialIds = new Set();
    const usedByMaterial = new Map();
    for (const m of measurements) {
        for (const u of m.materialUsed) {
            const key = u.materialId.toString();
            materialIds.add(key);
            usedByMaterial.set(key, (usedByMaterial.get(key) || 0) + u.quantity);
        }
    }
    for (const r of taggedWaste) materialIds.add(r._id.toString());
    for (const r of projectWasteTotal) materialIds.add(r._id.toString());
    const materials = materialIds.size ? await FinanceMaterial.find({ _id: { $in: [...materialIds] } }, 'name unit') : [];
    const materialById = new Map(materials.map(m => [m._id.toString(), m]));
    const nameUnit = (id) => ({ materialName: materialById.get(id.toString())?.name || 'Unknown', unit: materialById.get(id.toString())?.unit || '' });

    const materialUsed = [...usedByMaterial.entries()].map(([id, qty]) => ({ materialId: id, quantity: qty, ...nameUnit(id) }));
    const materialWasted = taggedWaste.map(r => ({ materialId: r._id, quantity: r.qty, ...nameUnit(r._id) }));
    const projectLevelWaste = projectWasteTotal.map(r => ({ materialId: r._id, quantity: r.qty, ...nameUnit(r._id) }));

    // Daily breakdown + Average Cost/Sqft = mean of each day's costPerSqft
    // ratio within the scope, NOT totalMaterialCost / totalArea — days with
    // zero material cost recorded are skipped, not counted as a zero ratio.
    const byDate = new Map();
    for (const m of measurements) {
        const dateKey = new Date(m.date).toISOString().slice(0, 10);
        if (!byDate.has(dateKey)) byDate.set(dateKey, { areaCoveredSqft: 0, materialCost: 0 });
        const entry = byDate.get(dateKey);
        entry.areaCoveredSqft += m.areaCoveredSqft;
        for (const u of m.materialUsed) entry.materialCost += u.quantity * (avgRate.get(u.materialId.toString()) || 0);
    }
    const dailyBreakdown = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, e]) => ({
        date, areaCoveredSqft: e.areaCoveredSqft, materialCost: e.materialCost,
        costPerSqft: e.areaCoveredSqft > 0 ? e.materialCost / e.areaCoveredSqft : 0,
    }));
    const ratiosWithMaterialCost = dailyBreakdown.filter(d => d.materialCost > 0).map(d => d.costPerSqft);
    const averageCostPerSqft = ratiosWithMaterialCost.length > 0
        ? ratiosWithMaterialCost.reduce((a, b) => a + b, 0) / ratiosWithMaterialCost.length
        : 0;

    return {
        areaCoveredSqft,
        contractorCost, contractorBreakdown,
        labourCost, labourBreakdown,
        totalCost: round2(contractorCost + labourCost),
        materialUsed, materialWasted, projectLevelWaste,
        dailyBreakdown, averageCostPerSqft,
    };
};

const getWorkProfit = async (req, res) => {
    try {
        const { workId } = req.query;
        if (!workId) return res.status(400).json({ success: false, message: 'workId is required' });
        const work = await FinanceWork.findOne({ _id: workId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found' });

        const wp = await computeWorkProfit(work);
        res.json({
            success: true,
            data: {
                workId: work._id, projectId: work.projectId, workType: work.workType,
                estimatedAreaSqft: work.estimatedAreaSqft, completedAreaSqft: work.completedAreaSqft,
                areaBilledSqft: wp.areaBilledSqft, revenue: wp.revenue, contractorCost: wp.contractorCost,
                contractorBreakdown: wp.contractorBreakdown,
                labourCost: wp.labourCost, labourBreakdown: wp.labourBreakdown,
                materialCost: wp.materialCost, profit: wp.profit,
                totalAreaSqft: wp.totalAreaSqft, totalAmount: wp.totalAmount,
                approvedAreaSqft: wp.approvedAreaSqft, approvedAmount: wp.approvedAmount, approvedDate: wp.approvedDate,
                unapprovedAreaSqft: wp.unapprovedAreaSqft, unapprovedAmount: wp.unapprovedAmount,
                expectedPay: wp.expectedPay, deductedTotal: wp.deductedTotal, expectedPayNetOfDeductions: wp.expectedPayNetOfDeductions,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing work profit' });
    }
};

// Tier-2 endpoint — everything about one work, scoped to exactly one of
// Day / Month / All Time at a time (never several simultaneous sections
// on the page — that got confusing fast). Revenue and Profit are the one
// exception left unscoped: they come from issued running bills, which
// aren't measurement-dated, so a "daily profit" isn't a coherent number
// to invent — they're always all-time, computeWorkProfit's own scope.
const getWorkDetail = async (req, res) => {
    try {
        const { workId, scope: rawScope, month, date, upto } = req.query;
        if (!workId) return res.status(400).json({ success: false, message: 'workId is required' });
        const work = await FinanceWork.findOne({ _id: workId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found' });
        // Kept separate from `work` on purpose — work.projectId stays a raw
        // ObjectId below since it feeds several other queries as a filter
        // value (computeWorkProfit, material avg rates, stock movements).
        const workProject = await FinanceProject.findById(work.projectId, 'name');
        const progressPercent = work.estimatedAreaSqft > 0 ? Math.min(100, Math.round((work.completedAreaSqft / work.estimatedAreaSqft) * 100)) : 0;

        const scope = ['day', 'month', 'alltime'].includes(rawScope) ? rawScope : 'alltime';
        let dateStart = null, dateEnd = null, scopeLabel = 'All Time';
        let monthKey = null, dateKey = null, cumulative = false;

        if (scope === 'day') {
            dateKey = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
            cumulative = upto === 'true' || upto === '1';
            dateEnd = new Date(`${dateKey}T23:59:59.999Z`);
            if (!cumulative) dateStart = new Date(`${dateKey}T00:00:00.000Z`);
            scopeLabel = cumulative ? `Up to ${dateKey}` : `On ${dateKey}`;
        } else if (scope === 'month') {
            monthKey = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
            const bounds = monthBounds(monthKey);
            dateStart = bounds.start; dateEnd = bounds.end;
            scopeLabel = monthKey;
        }

        const [avgRate, workProfit, materialStock] = await Promise.all([
            computeMaterialAvgRates(work.projectId),
            computeWorkProfit(work),
            computeCurrentStock(work.projectId),
        ]);
        const report = await computeWorkScopedReport(work, { dateStart, dateEnd, avgRate });

        res.json({
            success: true,
            data: {
                workId: work._id, projectId: work.projectId, projectName: workProject?.name || '—', workType: work.workType,
                estimatedAreaSqft: work.estimatedAreaSqft, completedAreaSqft: work.completedAreaSqft, progressPercent,
                scope, scopeLabel, month: monthKey, date: dateKey, cumulative,
                ...report,
                // All-time, billing-approval-based — overrides the scoped
                // (raw logged, ungated) contractorCost/labourCost `report`
                // spread in above, same "always all-time" treatment
                // revenue/profit already get: approval is a whole-Work
                // billing snapshot, not attributable to one specific
                // day/month. The scoped figures are kept under their own
                // key in case the Day/Month view still wants to show raw
                // logged cost for that window.
                scopedContractorCost: report.contractorCost, scopedLabourCost: report.labourCost,
                contractorCost: workProfit.contractorCost, labourCost: workProfit.labourCost,
                // Per-type all-time totals (workProfit.contractorBreakdown/
                // labourBreakdown already carry these per vendor/labourer —
                // summed here so the Contractor Cost/Labour Cost KPI cards
                // can each show their own "Total logged" figure next to
                // their Approved one, distinct from computeWorkExpectedPay's
                // blended totalAmount below).
                totalContractorAmount: round2(workProfit.contractorBreakdown.reduce((s, b) => s + b.totalAmount, 0)),
                totalLabourAmount: round2(workProfit.labourBreakdown.reduce((s, b) => s + b.totalAmount, 0)),
                totalAreaSqft: workProfit.totalAreaSqft, totalAmount: workProfit.totalAmount,
                approvedAreaSqft: workProfit.approvedAreaSqft, approvedAmount: workProfit.approvedAmount, approvedDate: workProfit.approvedDate,
                unapprovedAreaSqft: workProfit.unapprovedAreaSqft, unapprovedAmount: workProfit.unapprovedAmount,
                revenue: workProfit.revenue, profit: workProfit.profit,
                // Forward-looking, all-time only like revenue/profit above —
                // there's one estimatedAreaSqft per Work, not one per
                // Day/Month, so "expected pay for just this month" isn't a
                // coherent number either.
                expectedPay: workProfit.expectedPay, deductedTotal: workProfit.deductedTotal,
                expectedPayNetOfDeductions: workProfit.expectedPayNetOfDeductions,
                // Project-wide, always current — dump/return movements
                // aren't tied to one Work, so "material left" can't be
                // scoped to this Work's Day/Month/All Time selector.
                materialStock,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing work detail' });
    }
};

// Shared by getContractorAnalysis, dashboard summary, and the Contractors
// Tier-1 mini-dashboard — one earnings/advances/deductions/payments/balance
// row per labour contractor, optionally scoped to one project.
const computeContractorAnalysisRows = async (projectId) => {
    const contractors = await FinanceVendor.find({ vendorType: 'labour_contractor', deleted: { $ne: true } });

    return Promise.all(contractors.map(async (v) => {
        const assignments = await FinanceWorkContractorAssignment.find({ contractorVendorId: v._id, deleted: { $ne: true } });
        const workIds = assignments.map(a => a.workId);

        const workFilter = { _id: { $in: workIds }, deleted: { $ne: true } };
        if (projectId) workFilter.projectId = projectId;
        const works = workIds.length ? await FinanceWork.find(workFilter) : [];
        const workById = new Map(works.map(w => [w._id.toString(), w]));

        const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
        const [rates, vendorMeasurements, allMeasurementsOnTheseWorks, approvedBillingByWorkId] = await Promise.all([
            projectIds.length
                ? FinanceContractorRate.find({ projectId: { $in: projectIds }, contractorVendorId: v._id, deleted: { $ne: true } })
                : [],
            works.length
                ? FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, contractorVendorId: v._id, deleted: { $ne: true } }, 'workId areaCoveredSqft')
                : [],
            // Every contractor's measurements on these same works (any
            // vendor) — needed to proportionally split each work's billed
            // area when more than one vendor contributes to it.
            works.length
                ? FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId areaCoveredSqft')
                : [],
            works.length ? getApprovedBillingByWorkId(works.map(w => w._id)) : new Map(),
        ]);
        const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r]));

        const totalAreaByWork = new Map(); // all vendors combined, per work
        for (const m of allMeasurementsOnTheseWorks) {
            const key = m.workId.toString();
            totalAreaByWork.set(key, (totalAreaByWork.get(key) || 0) + m.areaCoveredSqft);
        }
        const vendorAreaByWork = new Map(); // this vendor only, per work
        for (const m of vendorMeasurements) {
            const key = m.workId.toString();
            vendorAreaByWork.set(key, (vendorAreaByWork.get(key) || 0) + m.areaCoveredSqft);
        }

        // Total = every logged sqft this vendor did, grouped by
        // (projectId, workType) for rate lookup — same grouping as before,
        // just no longer engineerApproved-gated. Approved = each work's
        // reviewed sqft (WorkReviewPanel), proportionally split to this
        // vendor's share (splitApprovedAreaByShare) — the Contractor
        // Ledger itself reads financeWorkReview directly per worker for
        // exact figures; this summary-level view keeps the same
        // proportional-estimate simplification already accepted elsewhere
        // in this file for the rare multi-worker-per-work case.
        const totalAreaByKey = new Map();
        const approvedAreaByKey = new Map();
        for (const work of works) {
            const workKey = work._id.toString();
            const vendorArea = vendorAreaByWork.get(workKey) || 0;
            if (!vendorArea) continue;
            const key = `${work.projectId}_${work.workType}`;
            totalAreaByKey.set(key, (totalAreaByKey.get(key) || 0) + vendorArea);
            const workApprovedArea = approvedBillingByWorkId.get(workKey)?.areaSqft || 0;
            const vendorApprovedArea = splitApprovedAreaByShare(workApprovedArea, vendorArea, totalAreaByWork.get(workKey) || 0);
            approvedAreaByKey.set(key, (approvedAreaByKey.get(key) || 0) + vendorApprovedArea);
        }
        let totalEarnings = 0;
        for (const [key, area] of totalAreaByKey) {
            const rate = rateByKey.get(key);
            if (rate) totalEarnings += area * (rate.ratePerSqft);
        }
        let earnings = 0; // "Approved" — this is what actually feeds Balance Payable
        for (const [key, area] of approvedAreaByKey) {
            const rate = rateByKey.get(key);
            if (rate) earnings += area * (rate.ratePerSqft);
        }
        totalEarnings = round2(totalEarnings);
        earnings = round2(earnings);

        const moneyFilter = { vendorId: v._id, deleted: { $ne: true } };
        if (projectId) moneyFilter.projectId = projectId;
        const [advances, deductions, payments] = await Promise.all([
            FinanceContractorAdvance.find(moneyFilter),
            FinanceContractorDeduction.find(moneyFilter),
            FinanceContractorPayment.find(moneyFilter),
        ]);
        const advancesTotal = advances.reduce((s, a) => s + a.amount, 0);
        const deductionsTotal = deductions.reduce((s, d) => s + d.amount, 0);
        const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0);
        const balancePayable = earnings - advancesTotal - deductionsTotal - paymentsTotal;

        return {
            // Field names match financeContractorLedger.js's getContractorLedger
            // totals shape (totalAmount/earnings/unapprovedAmount) so both
            // feeds render identically on the frontend.
            vendorId: v._id, vendorName: v.name, earnings, totalAmount: totalEarnings, unapprovedAmount: round2(totalEarnings - earnings),
            advances: advancesTotal, deductions: deductionsTotal, payments: paymentsTotal, balancePayable,
        };
    }));
};

const getContractorAnalysis = async (req, res) => {
    try {
        const { projectId } = req.query;
        const rows = await computeContractorAnalysisRows(projectId);
        res.json({ success: true, data: rows.sort((a, b) => b.balancePayable - a.balancePayable) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing contractor analysis' });
    }
};

// Direct labour-side mirror of computeContractorAnalysisRows — one
// earnings/advances/deductions/payments/balance row per labourer,
// optionally scoped to one project. No bulk company-wide labour ledger
// existed before this (only the per-labourer getLabourLedger); this fills
// that gap for Project Profitability's earnings table, same formula
// financeLabourLedger.js's getLabourLedger already uses.
const computeLabourAnalysisRows = async (projectId) => {
    const labourers = await FinanceLabourer.find({ deleted: { $ne: true } });

    return Promise.all(labourers.map(async (l) => {
        const assignments = await FinanceWorkLabourAssignment.find({ labourerId: l._id, deleted: { $ne: true } });
        const workIds = assignments.map(a => a.workId);

        const workFilter = { _id: { $in: workIds }, deleted: { $ne: true } };
        if (projectId) workFilter.projectId = projectId;
        const works = workIds.length ? await FinanceWork.find(workFilter) : [];

        const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
        const [rates, labourerMeasurements, allMeasurementsOnTheseWorks, approvedBillingByWorkId] = await Promise.all([
            projectIds.length
                ? FinanceLabourRate.find({ projectId: { $in: projectIds }, labourerId: l._id, deleted: { $ne: true } })
                : [],
            works.length
                ? FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, labourerId: l._id, deleted: { $ne: true } }, 'workId areaCoveredSqft')
                : [],
            // Every labourer's measurements on these same works — needed to
            // proportionally split each work's billed area when more than
            // one labourer contributes to it.
            works.length
                ? FinanceLabourMeasurement.find({ workId: { $in: works.map(w => w._id) }, deleted: { $ne: true } }, 'workId areaCoveredSqft')
                : [],
            works.length ? getApprovedBillingByWorkId(works.map(w => w._id)) : new Map(),
        ]);
        const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r]));

        const totalAreaByWork = new Map(); // all labourers combined, per work
        for (const m of allMeasurementsOnTheseWorks) {
            const key = m.workId.toString();
            totalAreaByWork.set(key, (totalAreaByWork.get(key) || 0) + m.areaCoveredSqft);
        }
        const labourerAreaByWork = new Map(); // this labourer only, per work
        for (const m of labourerMeasurements) {
            const key = m.workId.toString();
            labourerAreaByWork.set(key, (labourerAreaByWork.get(key) || 0) + m.areaCoveredSqft);
        }

        const totalAreaByKey = new Map();
        const approvedAreaByKey = new Map();
        for (const work of works) {
            const workKey = work._id.toString();
            const labourerArea = labourerAreaByWork.get(workKey) || 0;
            if (!labourerArea) continue;
            const key = `${work.projectId}_${work.workType}`;
            totalAreaByKey.set(key, (totalAreaByKey.get(key) || 0) + labourerArea);
            const workApprovedArea = approvedBillingByWorkId.get(workKey)?.areaSqft || 0;
            const labourerApprovedArea = splitApprovedAreaByShare(workApprovedArea, labourerArea, totalAreaByWork.get(workKey) || 0);
            approvedAreaByKey.set(key, (approvedAreaByKey.get(key) || 0) + labourerApprovedArea);
        }
        let totalEarnings = 0;
        for (const [key, area] of totalAreaByKey) {
            const rate = rateByKey.get(key);
            if (rate) totalEarnings += area * (rate.ratePerSqft);
        }
        let earnings = 0; // "Approved" — this is what actually feeds Balance Payable
        for (const [key, area] of approvedAreaByKey) {
            const rate = rateByKey.get(key);
            if (rate) earnings += area * (rate.ratePerSqft);
        }
        totalEarnings = round2(totalEarnings);
        earnings = round2(earnings);

        const moneyFilter = { labourerId: l._id, deleted: { $ne: true } };
        if (projectId) moneyFilter.projectId = projectId;
        const [advances, deductions, payments] = await Promise.all([
            FinanceLabourAdvance.find(moneyFilter),
            FinanceLabourDeduction.find(moneyFilter),
            FinanceLabourPayment.find(moneyFilter),
        ]);
        const advancesTotal = advances.reduce((s, a) => s + a.amount, 0);
        const deductionsTotal = deductions.reduce((s, d) => s + d.amount, 0);
        const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0);
        const balancePayable = earnings - advancesTotal - deductionsTotal - paymentsTotal;

        return {
            // Field names match financeLabourLedger.js's getLabourLedger
            // totals shape so both feeds render identically on the frontend.
            labourerId: l._id, labourerName: l.name, earnings, totalAmount: totalEarnings, unapprovedAmount: round2(totalEarnings - earnings),
            advances: advancesTotal, deductions: deductionsTotal, payments: paymentsTotal, balancePayable,
        };
    }));
};

const getLabourAnalysis = async (req, res) => {
    try {
        const { projectId } = req.query;
        const rows = await computeLabourAnalysisRows(projectId);
        res.json({ success: true, data: rows.sort((a, b) => b.balancePayable - a.balancePayable) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing labour analysis' });
    }
};

// New Tier-1 endpoint for Contractors — wraps computeContractorAnalysisRows
// for the table, plus cost-per-sqft grouped by work type (never blended
// across types — a Putty rate isn't comparable to a Paint rate).
const getContractorsSummary = async (req, res) => {
    try {
        const { projectId } = req.query;
        const contractors = await FinanceVendor.find({ vendorType: 'labour_contractor', deleted: { $ne: true } });
        const [rows, costPerSqft] = await Promise.all([
            computeContractorAnalysisRows(projectId),
            Promise.all(contractors.map(async (v) => {
                const assignments = await FinanceWorkContractorAssignment.find({ contractorVendorId: v._id, deleted: { $ne: true } });
                const workIds = assignments.map(a => a.workId);
                if (!workIds.length) return { vendorId: v._id, vendorName: v.name, byWorkType: [] };

                const workFilter = { _id: { $in: workIds }, deleted: { $ne: true } };
                if (projectId) workFilter.projectId = projectId;
                const works = await FinanceWork.find(workFilter);
                if (!works.length) return { vendorId: v._id, vendorName: v.name, byWorkType: [] };
                const workById = new Map(works.map(w => [w._id.toString(), w]));

                const [rates, measurements] = await Promise.all([
                    FinanceContractorRate.find({ projectId: { $in: [...new Set(works.map(w => w.projectId.toString()))] }, contractorVendorId: v._id, deleted: { $ne: true } }),
                    FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, contractorVendorId: v._id, deleted: { $ne: true } }),
                ]);
                const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r]));

                // cost/sqft is just the configured rate either way (earnings
                // ÷ area always cancels back to it) — not gated by billing
                // approval, unlike `earnings` in computeContractorAnalysisRows
                // above. Measurement-level, restricted to this contractor's
                // own work.
                const byType = new Map();
                for (const m of measurements) {
                    const work = workById.get(m.workId.toString());
                    if (!work) continue;
                    const rate = rateByKey.get(`${work.projectId}_${work.workType}`);
                    const earnings = rate ? m.areaCoveredSqft * (rate.ratePerSqft) : 0;
                    if (!byType.has(work.workType)) byType.set(work.workType, { area: 0, earnings: 0 });
                    const t = byType.get(work.workType);
                    t.area += m.areaCoveredSqft;
                    t.earnings += earnings;
                }
                const byWorkType = [...byType.entries()].map(([workType, t]) => ({
                    workType, completedAreaSqft: t.area, earnings: t.earnings,
                    costPerSqft: t.area > 0 ? t.earnings / t.area : 0,
                }));
                return { vendorId: v._id, vendorName: v.name, byWorkType };
            })),
        ]);

        res.json({ success: true, data: { contractors: rows.sort((a, b) => b.balancePayable - a.balancePayable), costPerSqft } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing contractors summary' });
    }
};

// INTERPRETATION FLAG: scoped strictly to vendorType 'material_supplier',
// not the broader "every non-contractor vendor" filter Payables' Vendor
// tab uses — referral vendors already get their own dedicated Commission
// numbers elsewhere in this module, so folding them into Vendor Analysis
// too would double-count the same balance under two report tabs.
const computeVendorAnalysisRows = async (projectId) => {
    const vendors = await FinanceVendor.find({ vendorType: 'material_supplier', deleted: { $ne: true } });

    return Promise.all(vendors.map(async (v) => {
        const purchaseFilter = { vendorId: v._id, deleted: { $ne: true } };
        if (projectId) purchaseFilter.projectId = projectId;
        const purchases = await FinancePurchase.find(purchaseFilter);

        const paymentFilter = { vendorId: v._id, deleted: { $ne: true } };
        if (projectId) paymentFilter.projectId = projectId;
        const payments = await FinanceVendorPayment.find(paymentFilter);

        const purchaseTotal = purchases.filter(p => p.transactionType === 'purchase').reduce((s, p) => s + p.totalAmount, 0);
        const returnTotal = purchases.filter(p => p.transactionType === 'return').reduce((s, p) => s + p.totalAmount, 0);
        const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0);
        const amountOwed = purchaseTotal - returnTotal - paymentsTotal;

        return { vendorId: v._id, vendorName: v.name, purchases: purchaseTotal, returns: returnTotal, payments: paymentsTotal, amountOwed };
    }));
};

const getVendorAnalysis = async (req, res) => {
    try {
        const { projectId } = req.query;
        const rows = await computeVendorAnalysisRows(projectId);
        res.json({ success: true, data: rows.sort((a, b) => b.amountOwed - a.amountOwed) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing vendor analysis' });
    }
};

// New Tier-1 endpoint for Procurement — wraps computeVendorAnalysisRows for
// the table, plus a monthly average-purchase-rate trend per material (top
// 5-10 by purchase volume by default, or the given materialIds) so rate
// creep is visible.
const getVendorsSummary = async (req, res) => {
    try {
        const { projectId, materialIds } = req.query;
        const rows = await computeVendorAnalysisRows(projectId);

        const purchaseFilter = { transactionType: 'purchase', deleted: { $ne: true } };
        if (projectId) purchaseFilter.projectId = projectId;
        const purchases = await FinancePurchase.find(purchaseFilter);

        const volumeByMaterial = new Map();
        for (const p of purchases) {
            const key = p.materialId.toString();
            volumeByMaterial.set(key, (volumeByMaterial.get(key) || 0) + p.quantity);
        }
        const materialIdList = materialIds
            ? materialIds.split(',')
            : [...volumeByMaterial.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);

        const materials = await FinanceMaterial.find({ _id: { $in: materialIdList } }, 'name unit');
        const materialById = new Map(materials.map(m => [m._id.toString(), m]));

        const trendMap = new Map();
        for (const p of purchases) {
            const key = p.materialId.toString();
            if (!materialIdList.includes(key)) continue;
            const month = new Date(p.date).toISOString().slice(0, 7);
            if (!trendMap.has(key)) trendMap.set(key, new Map());
            const monthMap = trendMap.get(key);
            if (!monthMap.has(month)) monthMap.set(month, { qty: 0, amt: 0 });
            const m = monthMap.get(month);
            m.qty += p.quantity;
            m.amt += p.totalAmount;
        }
        const materialCostTrend = materialIdList.map(id => {
            const material = materialById.get(id);
            const monthMap = trendMap.get(id) || new Map();
            const points = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
                .map(([month, m]) => ({ month, avgRate: m.qty > 0 ? m.amt / m.qty : 0 }));
            return { materialId: id, materialName: material?.name || 'Unknown', unit: material?.unit || '', points };
        });

        res.json({ success: true, data: { vendors: rows.sort((a, b) => b.amountOwed - a.amountOwed), materialCostTrend } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing vendors summary' });
    }
};

// INTERPRETATION FLAG: "total purchased"/"total returned" here read from
// financePurchase (the procurement-side record, and the same figures the
// weighted-average cost is derived from) — not from the `dump`/`return`
// stock movements a purchase/return auto-creates, which also include
// manual site-side entries (opening stock, ad-hoc returns) that never
// touched a vendor. "Total consumed"/"total wasted"/"current stock" stay
// on the stock-movement side, same as the existing Site Inventory current
// stock endpoint.
const getMaterialAnalysis = async (req, res) => {
    try {
        const { projectId } = req.query;
        const materials = await FinanceMaterial.find({ deleted: { $ne: true } });

        const purchaseFilter = { deleted: { $ne: true } };
        if (projectId) purchaseFilter.projectId = projectId;
        const purchases = await FinancePurchase.find(purchaseFilter);

        const stockMatch = { deleted: { $ne: true } };
        if (projectId) stockMatch.projectId = new mongoose.Types.ObjectId(projectId);
        const stockRows = await FinanceStockMovement.aggregate([
            { $match: stockMatch },
            {
                $group: {
                    _id: '$materialId',
                    dump:     { $sum: { $cond: [{ $eq: ['$movementType', 'dump'] }, '$quantity', 0] } },
                    consume:  { $sum: { $cond: [{ $eq: ['$movementType', 'consume'] }, '$quantity', 0] } },
                    returned: { $sum: { $cond: [{ $eq: ['$movementType', 'return'] }, '$quantity', 0] } },
                    waste:    { $sum: { $cond: [{ $eq: ['$movementType', 'waste'] }, '$quantity', 0] } },
                },
            },
        ]);
        const stockByMaterial = new Map(stockRows.map(r => [r._id.toString(), r]));

        const purchaseByMaterial = new Map();
        for (const p of purchases) {
            const key = p.materialId.toString();
            if (!purchaseByMaterial.has(key)) purchaseByMaterial.set(key, { purchasedQty: 0, purchasedAmt: 0, returnedQty: 0, returnedAmt: 0 });
            const m = purchaseByMaterial.get(key);
            if (p.transactionType === 'purchase') { m.purchasedQty += p.quantity; m.purchasedAmt += p.totalAmount; }
            else { m.returnedQty += p.quantity; m.returnedAmt += p.totalAmount; }
        }

        const rows = materials.map(mat => {
            const key = mat._id.toString();
            const p = purchaseByMaterial.get(key) || { purchasedQty: 0, purchasedAmt: 0, returnedQty: 0, returnedAmt: 0 };
            const s = stockByMaterial.get(key) || { dump: 0, consume: 0, returned: 0, waste: 0 };
            const netQty = p.purchasedQty - p.returnedQty;
            const netAmt = p.purchasedAmt - p.returnedAmt;
            return {
                materialId: mat._id, materialName: mat.name, unit: mat.unit,
                totalPurchased: p.purchasedQty, totalReturned: p.returnedQty,
                totalConsumed: s.consume, totalWasted: s.waste,
                currentStock: s.dump - s.consume - s.returned - s.waste,
                weightedAverageCost: netQty > 0 ? netAmt / netQty : 0,
            };
        }).filter(r => r.totalPurchased || r.totalReturned || r.totalConsumed || r.totalWasted || r.currentStock);

        res.json({ success: true, data: rows.sort((a, b) => a.materialName.localeCompare(b.materialName)) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing material analysis' });
    }
};

// New Tier-1 endpoint for Site Inventory — current stock per material (with
// a below-minimum flag), a monthly consumption trend, and the wastage rate
// (wasted ÷ (wasted + consumed)) per material, sorted highest-first.
//
// Low-stock definition is per-(project, material), matching the Dashboard's
// materialLowAlerts KPI exactly (see computeLowStockMaterialCount below) —
// a material can be below minimum at one project and fine at another, so a
// single project → one boolean is correct, but a company-wide view can't
// blend every project's stock into one total first (that hides a site
// that's actually out while another is overstocked) — it reports how many
// active projects are currently short instead.
const getInventorySummary = async (req, res) => {
    try {
        const { projectId, materialIds } = req.query;
        const materials = await FinanceMaterial.find({ deleted: { $ne: true } });

        const stockMatch = { deleted: { $ne: true } };
        if (projectId) stockMatch.projectId = new mongoose.Types.ObjectId(projectId);
        const stockRows = await FinanceStockMovement.aggregate([
            { $match: stockMatch },
            {
                $group: {
                    _id: { projectId: '$projectId', materialId: '$materialId' },
                    dump:     { $sum: { $cond: [{ $eq: ['$movementType', 'dump'] }, '$quantity', 0] } },
                    consume:  { $sum: { $cond: [{ $eq: ['$movementType', 'consume'] }, '$quantity', 0] } },
                    returned: { $sum: { $cond: [{ $eq: ['$movementType', 'return'] }, '$quantity', 0] } },
                    waste:    { $sum: { $cond: [{ $eq: ['$movementType', 'waste'] }, '$quantity', 0] } },
                },
            },
        ]);

        let stockTable;
        if (projectId) {
            // Single project — one row per material, same shape as before.
            const stockByMaterial = new Map(stockRows.map(r => [r._id.materialId.toString(), r]));
            stockTable = materials.map(mat => {
                const s = stockByMaterial.get(mat._id.toString()) || { dump: 0, consume: 0, returned: 0, waste: 0 };
                const currentStock = s.dump - s.consume - s.returned - s.waste;
                const wastageRate = (s.waste + s.consume) > 0 ? s.waste / (s.waste + s.consume) : 0;
                return {
                    materialId: mat._id, materialName: mat.name, unit: mat.unit,
                    currentStock, minimumStockLevel: mat.minimumStockLevel, belowMinimum: currentStock < mat.minimumStockLevel,
                    totalConsumed: s.consume, totalWasted: s.waste, wastageRate,
                };
            });
        } else {
            // Company-wide — per material, count how many active projects
            // are below minimum rather than blending stock across every
            // project into one misleading total.
            const activeProjectIds = new Set(
                (await FinanceProject.find({ status: 'active', deleted: { $ne: true } }, '_id')).map(p => p._id.toString())
            );
            const rowsByMaterial = new Map();
            for (const r of stockRows) {
                const key = r._id.materialId.toString();
                if (!rowsByMaterial.has(key)) rowsByMaterial.set(key, []);
                rowsByMaterial.get(key).push(r);
            }
            stockTable = materials.map(mat => {
                const rows = rowsByMaterial.get(mat._id.toString()) || [];
                let currentStock = 0, totalConsumed = 0, totalWasted = 0;
                let activeProjectCount = 0, lowAtProjectCount = 0;
                for (const r of rows) {
                    const projectStock = r.dump - r.consume - r.returned - r.waste;
                    currentStock += projectStock;
                    totalConsumed += r.consume;
                    totalWasted += r.waste;
                    if (activeProjectIds.has(r._id.projectId.toString())) {
                        activeProjectCount += 1;
                        if (projectStock < mat.minimumStockLevel) lowAtProjectCount += 1;
                    }
                }
                const wastageRate = (totalWasted + totalConsumed) > 0 ? totalWasted / (totalWasted + totalConsumed) : 0;
                return {
                    materialId: mat._id, materialName: mat.name, unit: mat.unit,
                    currentStock, minimumStockLevel: mat.minimumStockLevel,
                    belowMinimum: lowAtProjectCount > 0, lowAtProjectCount, activeProjectCount,
                    totalConsumed, totalWasted, wastageRate,
                };
            });
        }

        const consumeMatch = { movementType: 'consume', deleted: { $ne: true } };
        if (projectId) consumeMatch.projectId = new mongoose.Types.ObjectId(projectId);
        const consumeRows = await FinanceStockMovement.find(consumeMatch, 'materialId quantity date');
        const consumptionByMaterialMonth = new Map();
        for (const r of consumeRows) {
            const key = r.materialId.toString();
            const month = new Date(r.date).toISOString().slice(0, 7);
            if (!consumptionByMaterialMonth.has(key)) consumptionByMaterialMonth.set(key, new Map());
            const monthMap = consumptionByMaterialMonth.get(key);
            monthMap.set(month, (monthMap.get(month) || 0) + r.quantity);
        }

        const materialIdList = materialIds
            ? materialIds.split(',')
            : stockTable.filter(r => r.totalConsumed > 0).sort((a, b) => b.totalConsumed - a.totalConsumed).slice(0, 8).map(r => r.materialId.toString());
        const materialById = new Map(materials.map(m => [m._id.toString(), m]));
        const consumptionTrend = materialIdList.map(id => {
            const material = materialById.get(id);
            const monthMap = consumptionByMaterialMonth.get(id) || new Map();
            const points = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, qty]) => ({ month, qty }));
            return { materialId: id, materialName: material?.name || 'Unknown', unit: material?.unit || '', points };
        });

        const wastageRateSorted = stockTable
            .filter(r => r.totalWasted > 0 || r.totalConsumed > 0)
            .sort((a, b) => b.wastageRate - a.wastageRate);

        res.json({ success: true, data: { stockTable, consumptionTrend, wastageRateSorted } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing inventory summary' });
    }
};

const bucketKeyFor = (date, groupBy) => {
    const d = new Date(date);
    if (groupBy === 'month') return d.toISOString().slice(0, 7);
    if (groupBy === 'week') {
        const oneJan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    return d.toISOString().slice(0, 10);
};

// Shared by getCashFlow and getDashboardTrends' 30-day series so the two
// can never compute cash flow differently.
const computeCashFlow = async (from, to, groupBy = 'day') => {
    const receiptFilter = { deleted: { $ne: true } };
    const otherFilter = { deleted: { $ne: true } };
    if (from || to) {
        receiptFilter.receiptDate = {};
        otherFilter.date = {};
        if (from) { receiptFilter.receiptDate.$gte = new Date(from); otherFilter.date.$gte = new Date(from); }
        if (to) { receiptFilter.receiptDate.$lte = new Date(to); otherFilter.date.$lte = new Date(to); }
    }

    const [receipts, contractorPayments, vendorPayments, salaryPayments, commissionPayments, expenses] = await Promise.all([
        FinanceReceipt.find(receiptFilter),
        FinanceContractorPayment.find(otherFilter),
        FinanceVendorPayment.find(otherFilter),
        FinanceSalaryPayment.find(otherFilter),
        FinanceCommissionPayment.find(otherFilter),
        FinanceExpense.find(otherFilter),
    ]);

    const totalIn = receipts.reduce((s, r) => s + r.amount, 0);
    const outByCategory = {
        contractor: contractorPayments.reduce((s, p) => s + p.amount, 0),
        vendor: vendorPayments.reduce((s, p) => s + p.amount, 0),
        salary: salaryPayments.reduce((s, p) => s + p.amount, 0),
        commission: commissionPayments.reduce((s, p) => s + p.amount, 0),
        expense: expenses.reduce((s, e) => s + e.amount, 0),
    };
    const totalOut = Object.values(outByCategory).reduce((a, b) => a + b, 0);

    const series = new Map();
    const bump = (date, field, amount) => {
        const key = bucketKeyFor(date, groupBy);
        if (!series.has(key)) series.set(key, { bucket: key, in: 0, out: 0 });
        series.get(key)[field] += amount;
    };
    receipts.forEach(r => bump(r.receiptDate, 'in', r.amount));
    [...contractorPayments, ...vendorPayments, ...salaryPayments, ...commissionPayments, ...expenses]
        .forEach(p => bump(p.date, 'out', p.amount));

    const seriesArr = [...series.values()]
        .sort((a, b) => a.bucket.localeCompare(b.bucket))
        .map(s => ({ ...s, net: s.in - s.out }));

    return {
        totals: { in: totalIn, out: totalOut, net: totalIn - totalOut },
        byCategory: [
            { category: 'receipt', direction: 'in', amount: totalIn },
            ...Object.entries(outByCategory).map(([category, amount]) => ({ category, direction: 'out', amount })),
        ],
        series: seriesArr,
    };
};

const getCashFlow = async (req, res) => {
    try {
        const { from, to, groupBy = 'day' } = req.query;
        const data = await computeCashFlow(from, to, groupBy);
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing cash flow' });
    }
};

const getExpenseAnalysis = async (req, res) => {
    try {
        const { projectId, category, relatedToId, from, to } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        if (category) filter.expenseCategory = category;
        if (relatedToId) filter.relatedToId = relatedToId;
        if (from || to) {
            filter.date = {};
            if (from) filter.date.$gte = new Date(from);
            if (to) filter.date.$lte = new Date(to);
        }
        const expenses = await FinanceExpense.find(filter)
            .populate('projectId', 'name').populate('workId', 'workType').populate('relatedToId', 'name vendorType companyName')
            .sort({ date: -1 });
        const total = expenses.reduce((s, e) => s + e.amount, 0);

        const byCategoryMap = new Map();
        const byProjectMap = new Map();
        const byWorkMap = new Map();
        const byRelatedToMap = new Map();
        for (const e of expenses) {
            const cat = e.expenseCategory || 'Uncategorized';
            byCategoryMap.set(cat, (byCategoryMap.get(cat) || 0) + e.amount);

            const projKey = e.projectId ? e.projectId._id.toString() : 'general';
            const projName = e.projectId ? e.projectId.name : 'General / overhead';
            if (!byProjectMap.has(projKey)) byProjectMap.set(projKey, { projectId: e.projectId?._id || null, projectName: projName, amount: 0 });
            byProjectMap.get(projKey).amount += e.amount;

            if (e.workId) {
                const workKey = e.workId._id.toString();
                if (!byWorkMap.has(workKey)) byWorkMap.set(workKey, { workId: e.workId._id, workType: e.workId.workType, amount: 0 });
                byWorkMap.get(workKey).amount += e.amount;
            }

            if (e.relatedToId) {
                const relKey = e.relatedToId._id.toString();
                const relLabel = e.relatedToType === 'financeEmployee' ? 'Employee'
                    : e.relatedToType === 'financeLabourer' ? 'Labourer'
                    : e.relatedToType === 'financeCompanySettings' ? 'Company'
                    : e.relatedToId.vendorType === 'labour_contractor' ? 'Contractor' : 'Vendor';
                const relName = e.relatedToId.name || e.relatedToId.companyName;
                if (!byRelatedToMap.has(relKey)) byRelatedToMap.set(relKey, { relatedToId: e.relatedToId._id, relatedToType: relLabel, name: relName, amount: 0 });
                byRelatedToMap.get(relKey).amount += e.amount;
            }
        }

        res.json({
            success: true,
            data: {
                total,
                byCategory: [...byCategoryMap.entries()].map(([cat, amount]) => ({ category: cat, amount })).sort((a, b) => b.amount - a.amount),
                byProject: [...byProjectMap.values()].sort((a, b) => b.amount - a.amount),
                byWork: [...byWorkMap.values()].sort((a, b) => b.amount - a.amount),
                byRelatedTo: [...byRelatedToMap.values()].sort((a, b) => b.amount - a.amount),
                expenses,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing expense analysis' });
    }
};

const monthBounds = (month) => {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
};

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

// Company-wide, date-scoped material cost — same weighted-average-rate
// formula as computeProjectMaterialCost, but computed once across every
// project's purchases/consumption instead of looping per project (used by
// the dashboard's "This Month Profit" and the Revenue-vs-Cost trend, both
// of which need this for every project or a handful of months at once).
// Optional projectIds narrows to a specific set (e.g. active projects only).
const computeCompanyWideMaterialCostInRange = async (start, end, projectIds = null) => {
    const purchaseFilter = { deleted: { $ne: true } };
    if (projectIds) purchaseFilter.projectId = { $in: projectIds };
    const purchases = await FinancePurchase.find(purchaseFilter);
    const rateByKey = new Map();
    for (const p of purchases) {
        const key = `${p.projectId}_${p.materialId}`;
        if (!rateByKey.has(key)) rateByKey.set(key, { qty: 0, amt: 0 });
        const m = rateByKey.get(key);
        const sign = p.transactionType === 'return' ? -1 : 1;
        m.qty += sign * p.quantity;
        m.amt += sign * p.totalAmount;
    }
    const avgRate = new Map();
    for (const [key, m] of rateByKey) avgRate.set(key, m.qty > 0 ? m.amt / m.qty : 0);

    const consumeMatch = { movementType: 'consume', date: { $gte: start, $lte: end }, deleted: { $ne: true } };
    if (projectIds) consumeMatch.projectId = { $in: projectIds };
    const consumed = await FinanceStockMovement.aggregate([
        { $match: consumeMatch },
        { $group: { _id: { projectId: '$projectId', materialId: '$materialId' }, qty: { $sum: '$quantity' } } },
    ]);
    let total = 0;
    for (const row of consumed) total += row.qty * (avgRate.get(`${row._id.projectId}_${row._id.materialId}`) || 0);
    return total;
};

// Company-wide, date-scoped contractor cost — completedAreaSqft has no
// history of its own, so this uses dated FinanceMeasurement rows (the only
// dated record of "work done") as the proxy for when the area — and its
// contractor cost — was actually incurred, same approximation the
// project-progress chart relies on. Ungated (every logged measurement in
// range counts, not just billed-to-client ones) — same reasoning as
// computeWorkScopedReport: billing approval is a whole-Work snapshot, not
// attributable to a specific date range, so a monthly cost trend shows
// real costs incurred that month regardless of how far client billing has
// caught up.
const computeCompanyWideContractorCostInRange = async (start, end, projectIds = null) => {
    const match = { date: { $gte: start, $lte: end }, deleted: { $ne: true } };
    const measurements = await FinanceMeasurement.find(match).populate({ path: 'workId', select: 'projectId workType' });
    const relevant = measurements.filter(m => m.workId && m.contractorVendorId && (!projectIds || projectIds.some(id => id.toString() === m.workId.projectId.toString())));
    if (!relevant.length) return 0;

    // Grouping key is (work, contractor vendor) rather than work alone, so
    // a Work with more than one contributing contractor splits correctly.
    const areaByWorkVendor = new Map(); // `${workId}_${contractorVendorId}` -> area
    const workById = new Map();
    const vendorIds = new Set();
    for (const m of relevant) {
        const work = m.workId;
        const key = `${work._id}_${m.contractorVendorId}`;
        areaByWorkVendor.set(key, (areaByWorkVendor.get(key) || 0) + m.areaCoveredSqft);
        workById.set(work._id.toString(), work);
        vendorIds.add(m.contractorVendorId.toString());
    }
    if (!areaByWorkVendor.size) return 0;

    const works = [...workById.values()];
    const projIds = [...new Set(works.map(w => w.projectId.toString()))];
    const rates = await FinanceContractorRate.find({ projectId: { $in: projIds }, contractorVendorId: { $in: [...vendorIds] }, deleted: { $ne: true } });
    const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.contractorVendorId}_${r.workType}`, r]));

    let total = 0;
    for (const [key, area] of areaByWorkVendor) {
        const [workId, vendorId] = key.split('_');
        const w = workById.get(workId);
        const rate = rateByKey.get(`${w.projectId}_${vendorId}_${w.workType}`);
        if (rate) total += area * (rate.ratePerSqft);
    }
    return total;
};

// Mirrors computeCompanyWideContractorCostInRange, at individual-labourer
// granularity — no engineerApproved gate (financeLabourMeasurement has none).
const computeCompanyWideLabourCostInRange = async (start, end, projectIds = null) => {
    const match = { date: { $gte: start, $lte: end }, deleted: { $ne: true } };
    const measurements = await FinanceLabourMeasurement.find(match).populate({ path: 'workId', select: 'projectId workType' });
    const relevant = measurements.filter(m => m.workId && (!projectIds || projectIds.some(id => id.toString() === m.workId.projectId.toString())));
    if (!relevant.length) return 0;

    const areaByWorkLabourer = new Map(); // `${workId}_${labourerId}` -> area
    const workById = new Map();
    const labourerIds = new Set();
    for (const m of relevant) {
        const work = m.workId;
        const key = `${work._id}_${m.labourerId}`;
        areaByWorkLabourer.set(key, (areaByWorkLabourer.get(key) || 0) + m.areaCoveredSqft);
        workById.set(work._id.toString(), work);
        labourerIds.add(m.labourerId.toString());
    }
    if (!areaByWorkLabourer.size) return 0;

    const works = [...workById.values()];
    const projIds = [...new Set(works.map(w => w.projectId.toString()))];
    const rates = await FinanceLabourRate.find({ projectId: { $in: projIds }, labourerId: { $in: [...labourerIds] }, deleted: { $ne: true } });
    const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.labourerId}_${r.workType}`, r]));

    let total = 0;
    for (const [key, area] of areaByWorkLabourer) {
        const [workId, labourerId] = key.split('_');
        const w = workById.get(workId);
        const rate = rateByKey.get(`${w.projectId}_${labourerId}_${w.workType}`);
        if (rate) total += area * rate.ratePerSqft;
    }
    return total;
};

// Same measurement-date proxy as the contractor-cost helper above, scoped
// to projects that actually have a referral vendor (commission only applies
// there). Known gap: Advance projects' referralCommissionAmount is a flat
// manual figure with no date of its own, so it never contributes to this
// date-ranged view (only to the lifetime computeProjectCommissionCost) —
// same class of approximation as everything else in this function.
const computeCompanyWideCommissionCostInRange = async (start, end, projectIds = null) => {
    const match = { date: { $gte: start, $lte: end }, deleted: { $ne: true } };
    const measurements = await FinanceMeasurement.find(match).populate({ path: 'workId', select: 'projectId workType' });
    const relevant = measurements.filter(m => m.workId && (!projectIds || projectIds.some(id => id.toString() === m.workId.projectId.toString())));
    if (!relevant.length) return 0;

    const candidateProjectIds = [...new Set(relevant.map(m => m.workId.projectId.toString()))];
    const referralProjects = await FinanceProject.find({ _id: { $in: candidateProjectIds }, referralId: { $ne: null } }, '_id');
    const referralProjectIds = new Set(referralProjects.map(p => p._id.toString()));
    if (!referralProjectIds.size) return 0;

    const areaByProjectWorkType = new Map();
    for (const m of relevant) {
        const pid = m.workId.projectId.toString();
        if (!referralProjectIds.has(pid)) continue;
        const key = `${pid}_${m.workId.workType}`;
        areaByProjectWorkType.set(key, (areaByProjectWorkType.get(key) || 0) + m.areaCoveredSqft);
    }
    const rates = await FinanceWorkTypeRate.find({ projectId: { $in: [...referralProjectIds] }, deleted: { $ne: true } });
    const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r.referralRatePerSqft]));

    let total = 0;
    for (const [key, area] of areaByProjectWorkType) total += area * (rateByKey.get(key) || 0);
    return total;
};

// Counts a material once if it's short at ANY active project — same
// per-(project, material) definition as Site Inventory's company-wide view
// (getInventorySummary above), so the two never disagree on the same
// underlying data. Scoped to active projects, same as this endpoint's other
// "this month" figures — a draft or completed project's stock isn't
// actionable the way an active site's is.
const computeLowStockMaterialCount = async (activeProjectIds) => {
    const materials = await FinanceMaterial.find({ deleted: { $ne: true } });
    if (!materials.length) return 0;
    const rows = await FinanceStockMovement.aggregate([
        { $match: { projectId: { $in: activeProjectIds }, deleted: { $ne: true } } },
        {
            $group: {
                _id: { projectId: '$projectId', materialId: '$materialId' },
                dump:     { $sum: { $cond: [{ $eq: ['$movementType', 'dump'] }, '$quantity', 0] } },
                consume:  { $sum: { $cond: [{ $eq: ['$movementType', 'consume'] }, '$quantity', 0] } },
                returned: { $sum: { $cond: [{ $eq: ['$movementType', 'return'] }, '$quantity', 0] } },
                waste:    { $sum: { $cond: [{ $eq: ['$movementType', 'waste'] }, '$quantity', 0] } },
            },
        },
    ]);
    const materialById = new Map(materials.map(m => [m._id.toString(), m]));
    const lowMaterialIds = new Set();
    for (const row of rows) {
        const material = materialById.get(row._id.materialId.toString());
        if (!material) continue;
        const currentStock = row.dump - row.consume - row.returned - row.waste;
        if (currentStock < material.minimumStockLevel) lowMaterialIds.add(row._id.materialId.toString());
    }
    return lowMaterialIds.size;
};

const AGE_BUCKET_KEYS = ['0-30', '30-60', '60-90', '90+'];
const bucketForAgeDays = (days) => (days <= 30 ? '0-30' : days <= 60 ? '30-60' : days <= 90 ? '60-90' : '90+');

// Per-bill remaining balance: receipts tied to a specific runningBillId
// reduce that bill directly; receipts with no runningBillId (a lump-sum
// payment not tied to one bill) reduce the oldest still-open bill first —
// `bills` must already be sorted oldest-first by billDate.
const computeBillBalances = (bills, receipts) => {
    const balances = new Map(bills.map(b => [b._id.toString(), b.totalAmount]));
    for (const r of receipts) {
        if (r.runningBillId && balances.has(r.runningBillId.toString())) {
            const key = r.runningBillId.toString();
            balances.set(key, balances.get(key) - r.amount);
        }
    }
    let pool = receipts.filter(r => !r.runningBillId).reduce((s, r) => s + r.amount, 0);
    for (const b of bills) {
        if (pool <= 0) break;
        const key = b._id.toString();
        const bal = balances.get(key);
        if (bal <= 0) continue;
        const applied = Math.min(bal, pool);
        balances.set(key, bal - applied);
        pool -= applied;
    }
    return balances;
};

// Receivables aging — 0-30/30-60/60-90/90+ days since each bill's billDate,
// today as the reference point. `bills` must be sorted oldest-first.
const computeAging = (bills, receipts) => {
    const balances = computeBillBalances(bills, receipts);
    const today = new Date();
    const buckets = { '0-30': 0, '30-60': 0, '60-90': 0, '90+': 0 };
    for (const b of bills) {
        const bal = Math.max(0, balances.get(b._id.toString()) || 0);
        if (bal <= 0) continue;
        const days = Math.floor((today - new Date(b.billDate)) / 86400000);
        buckets[bucketForAgeDays(days)] += bal;
    }
    return buckets;
};

// Dashboard "Approved" section — every Work that's been billed to the
// client via ANY issued running bill, company-wide, grouped by work type
// (Putty/Paint/...) plus a Contractor-total/Labour-total split. Unlike the
// Site Activity boxes above it (which show raw logged "today" activity,
// deliberately unconditional), this is cumulative and billing-derived —
// there's no "today" version of Approved, since a bill's approval doesn't
// expire.
//
// KNOWN LIMITATION: same as computeWorkExpectedPay — a work with more than
// one contributing vendor/labourer sums each one's rate × the work's full
// approved area rather than a real split (no data records how a work's
// billed area actually divides between multiple contributors). Acceptable
// for a company-wide glance total; the precise per-work/per-vendor split
// lives in the Ledger views instead.
// "Approved" here means the same thing it means everywhere else in the
// app now (financeWorkReview — reviewed, not billed): per (work,
// contractor-or-labourer) actual measured area, split into what's been
// reviewed (approvedAreaSqft) vs not yet (the remainder) — same shape
// Contractor/Labour Ledger already surface per vendor, just company-wide
// and grouped by work type here. Used to read straight off issued running
// bills' lineItems (the pre-review "billed" meaning of Approved),
// silently drifting out of step with every other Approved figure in the
// app once review was introduced as its own confirmation step.
const computeDashboardApprovedBreakdown = async () => {
    // status: {$ne:'completed'} — this is a live operational pipeline
    // widget ("what's currently moving through review/billing"), not a
    // financial rollup, so a finished project's work drops out of it once
    // complete (it still counts toward Total Revenue/Profit elsewhere).
    const works = await FinanceWork.find({ status: { $ne: 'completed' }, deleted: { $ne: true } }, 'workType projectId');
    if (!works.length) return { byWorkType: [], contractorTotal: 0, labourTotal: 0, unapprovedByWorkType: [], unapprovedContractorTotal: 0, unapprovedLabourTotal: 0 };
    const workIds = works.map(w => w._id);
    const workById = new Map(works.map(w => [w._id.toString(), w]));

    const [contractorMeasurements, labourMeasurements, reviews] = await Promise.all([
        FinanceMeasurement.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId contractorVendorId areaCoveredSqft'),
        FinanceLabourMeasurement.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId labourerId areaCoveredSqft'),
        FinanceWorkReview.find({ workId: { $in: workIds } }, 'workId partyType partyId approvedAreaSqft'),
    ]);

    const totalAreaByWorkContractor = new Map(); // `${workId}_${vendorId}` -> area
    for (const m of contractorMeasurements) {
        if (!m.contractorVendorId) continue;
        const key = `${m.workId}_${m.contractorVendorId}`;
        totalAreaByWorkContractor.set(key, (totalAreaByWorkContractor.get(key) || 0) + m.areaCoveredSqft);
    }
    const totalAreaByWorkLabourer = new Map();
    for (const m of labourMeasurements) {
        const key = `${m.workId}_${m.labourerId}`;
        totalAreaByWorkLabourer.set(key, (totalAreaByWorkLabourer.get(key) || 0) + m.areaCoveredSqft);
    }
    const approvedAreaByWorkContractor = new Map();
    const approvedAreaByWorkLabourer = new Map();
    for (const r of reviews) {
        const key = `${r.workId}_${r.partyId}`;
        (r.partyType === 'contractor' ? approvedAreaByWorkContractor : approvedAreaByWorkLabourer).set(key, r.approvedAreaSqft);
    }

    const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
    const allVendorIds = [...new Set([...totalAreaByWorkContractor.keys()].map(k => k.split('_')[1]))];
    const allLabourerIds = [...new Set([...totalAreaByWorkLabourer.keys()].map(k => k.split('_')[1]))];
    const [contractorRates, labourRates] = await Promise.all([
        allVendorIds.length ? FinanceContractorRate.find({ projectId: { $in: projectIds }, contractorVendorId: { $in: allVendorIds }, deleted: { $ne: true } }) : [],
        allLabourerIds.length ? FinanceLabourRate.find({ projectId: { $in: projectIds }, labourerId: { $in: allLabourerIds }, deleted: { $ne: true } }) : [],
    ]);
    const contractorRateByKey = new Map(contractorRates.map(r => [`${r.projectId}_${r.contractorVendorId}_${r.workType}`, r.ratePerSqft]));
    const labourRateByKey = new Map(labourRates.map(r => [`${r.projectId}_${r.labourerId}_${r.workType}`, r.ratePerSqft]));

    const bump = (map, workType, sqft, amount) => {
        const cur = map.get(workType) || { sqft: 0, amount: 0 };
        cur.sqft += sqft; cur.amount += amount;
        map.set(workType, cur);
    };
    const byWorkType = new Map(), unapprovedByWorkType = new Map();
    let contractorTotal = 0, labourTotal = 0, unapprovedContractorTotal = 0, unapprovedLabourTotal = 0;

    for (const [key, totalArea] of totalAreaByWorkContractor) {
        const [workId, vendorId] = key.split('_');
        const w = workById.get(workId);
        const rate = contractorRateByKey.get(`${w.projectId}_${vendorId}_${w.workType}`);
        if (!rate) continue;
        const approvedArea = Math.min(approvedAreaByWorkContractor.get(key) || 0, totalArea);
        const unapprovedArea = totalArea - approvedArea;
        contractorTotal += approvedArea * rate;
        unapprovedContractorTotal += unapprovedArea * rate;
        bump(byWorkType, w.workType, approvedArea, approvedArea * rate);
        bump(unapprovedByWorkType, w.workType, unapprovedArea, unapprovedArea * rate);
    }
    for (const [key, totalArea] of totalAreaByWorkLabourer) {
        const [workId, labourerId] = key.split('_');
        const w = workById.get(workId);
        const rate = labourRateByKey.get(`${w.projectId}_${labourerId}_${w.workType}`);
        if (!rate) continue;
        const approvedArea = Math.min(approvedAreaByWorkLabourer.get(key) || 0, totalArea);
        const unapprovedArea = totalArea - approvedArea;
        labourTotal += approvedArea * rate;
        unapprovedLabourTotal += unapprovedArea * rate;
        bump(byWorkType, w.workType, approvedArea, approvedArea * rate);
        bump(unapprovedByWorkType, w.workType, unapprovedArea, unapprovedArea * rate);
    }

    const toArray = (map) => [...map.entries()].map(([workType, v]) => ({ workType, sqft: round2(v.sqft), amount: round2(v.amount) })).sort((a, b) => b.sqft - a.sqft);
    return {
        byWorkType: toArray(byWorkType), contractorTotal: round2(contractorTotal), labourTotal: round2(labourTotal),
        unapprovedByWorkType: toArray(unapprovedByWorkType), unapprovedContractorTotal: round2(unapprovedContractorTotal), unapprovedLabourTotal: round2(unapprovedLabourTotal),
    };
};

// "Ready to Bill" — projects with at least one Work whose REVIEWED area
// (getApprovedBillingByWorkId — "Approved" now means reviewed, not billed)
// exceeds what's already in an issued bill (getBilledAreaByWorkId).
// Deliberately NOT completedAreaSqft vs reviewed — that gap is "pending
// review" (a project needing attention in the review panel, not one
// that's actually ready for Generate Bill). A lighter-weight sibling of
// computeWorkExpectedPay: skips the deduction/expected-pay machinery
// entirely since this KPI only needs the Reviewed-vs-Billed gap.
const computeReadyProjectIds = async (billableProjectIds) => {
    const works = await FinanceWork.find(
        // status: {$ne:'completed'} — a completed Work is done accruing
        // billable area either way (its project's completion pre-flight
        // check already surfaced any leftover unbilled sqft, and the user
        // either cleared it or explicitly overrode), so it shouldn't keep
        // nudging "ready to bill" on the dashboard forever after.
        { projectId: { $in: billableProjectIds }, deleted: { $ne: true }, completedAreaSqft: { $gt: 0 }, status: { $ne: 'completed' } },
        'projectId completedAreaSqft'
    );
    if (!works.length) return [];
    const workIds = works.map(w => w._id);
    const [approvedByWorkId, billedByWorkId] = await Promise.all([
        getApprovedBillingByWorkId(workIds),
        getBilledAreaByWorkId(workIds),
    ]);
    const readyProjectIds = new Set();
    for (const w of works) {
        const approved = approvedByWorkId.get(w._id.toString())?.areaSqft || 0;
        const billed = billedByWorkId.get(w._id.toString())?.areaSqft || 0;
        if (approved - billed > 0.001) readyProjectIds.add(w.projectId.toString());
    }
    return [...readyProjectIds];
};

// Pre-flight check for "Mark Project Completed" (financeProject.js's
// completeFinanceProject) — everything that could still be financially
// outstanding on this project, gathered from the same computations already
// used elsewhere (nothing new invented) so this can never drift from what
// the Ledgers/Payables/Receivables pages themselves would show. Warn-only
// by design (the caller decides whether blockers actually stop completion)
// — this just reports what's there.
const getProjectCompletionReadiness = async (projectId) => {
    const project = await FinanceProject.findById(projectId);
    if (!project) throw new Error('Project not found');

    const works = await FinanceWork.find({ projectId, deleted: { $ne: true } });
    const workIds = works.map(w => w._id);
    const blockers = [];

    if (workIds.length) {
        // Unreviewed work — every work's own Total-vs-Approved(reviewed) gap,
        // same figure the review panel and Ledgers already surface. A
        // project shouldn't be markable complete with work nobody's ever
        // actually reviewed.
        const expectedPays = await Promise.all(works.map(w => computeWorkExpectedPay(w)));
        const unapprovedAreaSqft = round2(expectedPays.reduce((s, wp) => s + wp.unapprovedAreaSqft, 0));
        const unapprovedAmount = round2(expectedPays.reduce((s, wp) => s + wp.unapprovedAmount, 0));
        if (unapprovedAreaSqft > 0.01) {
            blockers.push({ category: 'unbilled_work', label: `${unapprovedAreaSqft} sqft logged but never reviewed`, amount: unapprovedAmount });
        }

        // Contractor/labour balances still owed on THIS project specifically
        // — same formula as the Ledgers (earnings − advances − deductions −
        // payments), narrowed to this project's Works via the assignment
        // rows still on them.
        const [contractorAssignments, labourAssignments] = await Promise.all([
            FinanceWorkContractorAssignment.find({ workId: { $in: workIds }, deleted: { $ne: true } }),
            FinanceWorkLabourAssignment.find({ workId: { $in: workIds }, deleted: { $ne: true } }),
        ]);

        if (contractorAssignments.length) {
            const vendorIds = new Set(contractorAssignments.map(a => a.contractorVendorId.toString()));
            const rows = await computeContractorAnalysisRows(projectId);
            for (const r of rows) {
                if (vendorIds.has(r.vendorId.toString()) && Math.abs(r.balancePayable) > 0.5) {
                    blockers.push({ category: 'contractor_balance', label: `${r.vendorName} — contractor balance`, amount: round2(r.balancePayable) });
                }
            }
        }

        if (labourAssignments.length) {
            const labourBalances = await computeLabourBalancesForProject(projectId, works);
            for (const r of labourBalances) {
                if (Math.abs(r.balancePayable) > 0.5) {
                    blockers.push({ category: 'labour_balance', label: `${r.labourerName} — labour balance`, amount: r.balancePayable });
                }
            }
        }
    }

    // Draft bills — money already earned that hasn't even been sent to the
    // client yet, let alone paid.
    const draftBills = await FinanceRunningBill.find({ projectId, status: 'draft', deleted: { $ne: true } });
    if (draftBills.length) {
        const draftTotal = round2(draftBills.reduce((s, b) => s + b.totalAmount, 0));
        blockers.push({ category: 'draft_bills', label: `${draftBills.length} draft bill${draftBills.length === 1 ? '' : 's'} never issued to the client`, amount: draftTotal });
    }

    // Vendor (material supplier) balances on this project.
    const vendorRows = await computeVendorAnalysisRows(projectId);
    for (const r of vendorRows.filter(r => Math.abs(r.amountOwed) > 0.5)) {
        blockers.push({ category: 'vendor_balance', label: `${r.vendorName} — material supplier balance`, amount: round2(r.amountOwed) });
    }

    // Client receivables — issued bills the client hasn't fully paid yet.
    const receivable = await summarizeProject(project);
    if (receivable.balance > 0.5) {
        blockers.push({ category: 'receivable', label: 'Outstanding balance owed by the client', amount: round2(receivable.balance) });
    }

    // Advance credit not yet drawn down against a bill (advance-contract
    // projects only) — same query generateRunningBill's applyAdvanceCredit
    // uses to find drawable advance receipts.
    if (project.contractType === 'advance') {
        if (!project.advanceReceived) {
            blockers.push({ category: 'advance_not_received', label: 'Advance payment was never recorded as received', amount: project.advanceAmount || 0 });
        } else {
            const undrawn = await FinanceReceipt.find({ projectId, isAdvance: true, runningBillId: null, deleted: { $ne: true } });
            const undrawnTotal = round2(undrawn.reduce((s, r) => s + r.amount, 0));
            if (undrawnTotal > 0.5) {
                blockers.push({ category: 'advance_undrawn', label: 'Advance credit not yet drawn against any bill', amount: undrawnTotal });
            }
        }
    }

    return { blockers, hasBlockers: blockers.length > 0 };
};

// Bulk labour-balance helper for getProjectCompletionReadiness — no
// company-wide bulk equivalent of getContractorLedger exists for labour
// (unlike computeContractorAnalysisRows on the contractor side), so this
// mirrors that same formula, narrowed to one project's Works directly
// rather than scanning every labourer in the company.
const computeLabourBalancesForProject = async (projectId, works) => {
    const workIds = works.map(w => w._id);
    const [assignments, allMeasurements, approvedBillingByWorkId] = await Promise.all([
        FinanceWorkLabourAssignment.find({ workId: { $in: workIds }, deleted: { $ne: true } }),
        FinanceLabourMeasurement.find({ workId: { $in: workIds }, deleted: { $ne: true } }, 'workId labourerId areaCoveredSqft'),
        getApprovedBillingByWorkId(workIds),
    ]);
    const labourerIds = [...new Set(assignments.map(a => a.labourerId.toString()))];
    if (!labourerIds.length) return [];

    const [labourers, rates] = await Promise.all([
        FinanceLabourer.find({ _id: { $in: labourerIds } }),
        FinanceLabourRate.find({ projectId, labourerId: { $in: labourerIds }, deleted: { $ne: true } }),
    ]);
    const labourerById = new Map(labourers.map(l => [l._id.toString(), l]));
    const rateByKey = new Map(rates.map(r => [`${r.labourerId}_${r.workType}`, r.ratePerSqft]));

    const totalAreaByWork = new Map();
    const areaByLabourerWork = new Map();
    for (const m of allMeasurements) {
        const wk = m.workId.toString();
        totalAreaByWork.set(wk, (totalAreaByWork.get(wk) || 0) + m.areaCoveredSqft);
        const key = `${m.labourerId}_${wk}`;
        areaByLabourerWork.set(key, (areaByLabourerWork.get(key) || 0) + m.areaCoveredSqft);
    }

    const earningsByLabourer = new Map();
    for (const w of works) {
        const wk = w._id.toString();
        const totalArea = totalAreaByWork.get(wk) || 0;
        if (!totalArea) continue;
        const workApprovedArea = approvedBillingByWorkId.get(wk)?.areaSqft || 0;
        for (const labourerId of labourerIds) {
            const labourerArea = areaByLabourerWork.get(`${labourerId}_${wk}`) || 0;
            if (!labourerArea) continue;
            const rate = rateByKey.get(`${labourerId}_${w.workType}`);
            if (!rate) continue;
            const approvedArea = splitApprovedAreaByShare(workApprovedArea, labourerArea, totalArea);
            earningsByLabourer.set(labourerId, (earningsByLabourer.get(labourerId) || 0) + approvedArea * rate);
        }
    }

    const moneyFilter = { projectId, deleted: { $ne: true } };
    return Promise.all(labourerIds.map(async (labourerId) => {
        const [advances, deductions, payments] = await Promise.all([
            FinanceLabourAdvance.find({ ...moneyFilter, labourerId }),
            FinanceLabourDeduction.find({ ...moneyFilter, labourerId }),
            FinanceLabourPayment.find({ ...moneyFilter, labourerId }),
        ]);
        const earnings = round2(earningsByLabourer.get(labourerId) || 0);
        const advancesTotal = advances.reduce((s, a) => s + a.amount, 0);
        const deductionsTotal = deductions.reduce((s, d) => s + d.amount, 0);
        const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0);
        return {
            labourerId, labourerName: labourerById.get(labourerId)?.name || '—',
            balancePayable: round2(earnings - advancesTotal - deductionsTotal - paymentsTotal),
        };
    }));
};

// Tier-0 Company Dashboard KPIs — every number here is meant to be a
// doorway into a Tier-1/Tier-2 page, not a granular breakdown of its own.
const getDashboardSummary = async (req, res) => {
    try {
        const today = new Date();
        const todayStart = startOfDay(today);
        const todayEnd = endOfDay(today);
        const monthKey = today.toISOString().slice(0, 7);
        const { start: monthStart, end: monthEnd } = monthBounds(monthKey);

        const billableProjects = await FinanceProject.find({ deleted: { $ne: true }, contractType: { $in: BILLABLE_CONTRACT_TYPES } }, '_id');
        const billableProjectIds = billableProjects.map(p => p._id);
        const activeProjects = await FinanceProject.find({ status: 'active', deleted: { $ne: true } }, '_id');
        const activeProjectIds = activeProjects.map(p => p._id);
        // Completed Works are done accruing "today's site activity" — a
        // finished project's historical revenue/cost still counts toward
        // Total Profit below, it just stops nudging the operational
        // "what's happening today" cards.
        const completedWorkIds = await FinanceWork.distinct('_id', { status: 'completed', deleted: { $ne: true } });

        const [
            bankAccounts, cashEntriesToDate, issuedAgg, receivedAgg, contractorRows, vendorRows,
            readyProjectIds, activeProjectsCount, activeWorksCount, labourersWorkingTodayIds, lowStockCount,
            todayContractorMeasurements, todayLabourMeasurements, monthRevenueAgg, recentActivities,
        ] = await Promise.all([
            FinanceBankAccount.find({ deleted: { $ne: true } }),
            FinanceCashEntry.find({ deleted: { $ne: true }, date: { $lte: todayEnd } }),
            FinanceRunningBill.aggregate([
                { $match: { projectId: { $in: billableProjectIds }, status: 'issued', deleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } },
            ]),
            FinanceReceipt.aggregate([
                { $match: { projectId: { $in: billableProjectIds }, deleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            computeContractorAnalysisRows(),
            computeVendorAnalysisRows(),
            computeReadyProjectIds(billableProjectIds),
            FinanceProject.countDocuments({ status: 'active', deleted: { $ne: true } }),
            FinanceWork.countDocuments({ status: 'active', deleted: { $ne: true } }),
            FinanceLabourMeasurement.distinct('labourerId', { date: { $gte: todayStart, $lte: todayEnd }, deleted: { $ne: true }, workId: { $nin: completedWorkIds } }),
            computeLowStockMaterialCount(activeProjectIds),
            // Today's Measurement / Site Activity deliberately reads both
            // contractor and labour measurements with no engineerApproved
            // filter — completedAreaSqft itself updates unapproved (see
            // financeMeasurement.js/financeLabourMeasurement.js add
            // handlers), so the dashboard should show what was actually
            // logged on site today, not what's cleared for billing yet.
            // Excludes completed Works — see completedWorkIds above.
            FinanceMeasurement.find({ date: { $gte: todayStart, $lte: todayEnd }, deleted: { $ne: true }, workId: { $nin: completedWorkIds } }, 'workId areaCoveredSqft'),
            FinanceLabourMeasurement.find({ date: { $gte: todayStart, $lte: todayEnd }, deleted: { $ne: true }, workId: { $nin: completedWorkIds } }, 'workId areaCoveredSqft'),
            FinanceRunningBill.aggregate([
                { $match: { status: 'issued', billDate: { $gte: monthStart, $lte: monthEnd }, deleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } },
            ]),
            FinanceActivityLog.find().sort({ timestamp: -1 }).limit(15),
        ]);

        const bankBalances = await Promise.all(bankAccounts.map(async (a) => {
            const activity = await getAccountActivity(a._id);
            const net = activity.reduce((sum, t) => sum + (t.direction === 'credit' ? t.amount : -t.amount), 0);
            return a.openingBalance + net;
        }));
        const cashInBank = bankBalances.reduce((a, b) => a + b, 0);
        const cashInHand = cashEntriesToDate.reduce((sum, e) => sum + (e.type === 'in' ? e.amount : -e.amount), 0);

        // Site Activity — today's measurements spliced by Work (not the flat,
        // mixed-with-every-event-type recentActivities feed), so every work
        // that had area logged today shows up as its own line, contractor and
        // labour entries combined into one sqft figure per work.
        const todaysContractorMeasurementSqft = todayContractorMeasurements.reduce((s, m) => s + m.areaCoveredSqft, 0);
        const todaysLabourMeasurementSqft = todayLabourMeasurements.reduce((s, m) => s + m.areaCoveredSqft, 0);
        const todaysMeasurementSqft = todaysContractorMeasurementSqft + todaysLabourMeasurementSqft;
        const sqftByWorkId = new Map();
        for (const m of [...todayContractorMeasurements, ...todayLabourMeasurements]) {
            const key = m.workId.toString();
            sqftByWorkId.set(key, (sqftByWorkId.get(key) || 0) + m.areaCoveredSqft);
        }
        const todaysWorkIds = [...sqftByWorkId.keys()];
        const [todaysWorksById, workDeductions, workLabourDeductions, workSupervisorDeductions] = await Promise.all([
            FinanceWork.find({ _id: { $in: todaysWorkIds } }, 'workType projectId estimatedAreaSqft completedAreaSqft')
                .populate('projectId', 'name'),
            // "Expectations vs reality" per work: estimatedAreaSqft (target)
            // vs completedAreaSqft (logged so far, unapproved-inclusive —
            // same "show it even before approval" rule as the KPI above).
            // Deducted total is a manually-entered figure (engineer/
            // supervisor typed in an amount against this specific work, see
            // financeContractorDeduction.js/financeLabourDeduction.js/
            // financeSupervisorDeduction.js workId field) — never
            // auto-computed from the approval gate.
            FinanceContractorDeduction.aggregate([
                { $match: { workId: { $in: todaysWorkIds.map(id => new mongoose.Types.ObjectId(id)) }, deleted: { $ne: true } } },
                { $group: { _id: '$workId', total: { $sum: '$amount' } } },
            ]),
            FinanceLabourDeduction.aggregate([
                { $match: { workId: { $in: todaysWorkIds.map(id => new mongoose.Types.ObjectId(id)) }, deleted: { $ne: true } } },
                { $group: { _id: '$workId', total: { $sum: '$amount' } } },
            ]),
            FinanceSupervisorDeduction.aggregate([
                { $match: { workId: { $in: todaysWorkIds.map(id => new mongoose.Types.ObjectId(id)) }, deleted: { $ne: true } } },
                { $group: { _id: '$workId', total: { $sum: '$amount' } } },
            ]),
        ]);
        const deductedByWorkId = new Map();
        for (const r of [...workDeductions, ...workLabourDeductions, ...workSupervisorDeductions]) {
            const key = r._id.toString();
            deductedByWorkId.set(key, (deductedByWorkId.get(key) || 0) + r.total);
        }
        // expectedPay reuses computeWorkExpectedPay (only its expectedPay
        // figure — deductedByWorkId above is already the same total, no
        // need to make it re-derive that part).
        const expectedPayByWorkId = new Map(
            (await Promise.all(todaysWorksById.map(async w => [w._id.toString(), (await computeWorkExpectedPay(w)).expectedPay])))
        );
        const todaysWorkActivity = todaysWorksById
            .map(w => {
                const deductedAmount = deductedByWorkId.get(w._id.toString()) || 0;
                const expectedPay = expectedPayByWorkId.get(w._id.toString()) || 0;
                return {
                    workId: w._id, workType: w.workType,
                    projectId: w.projectId?._id, projectName: w.projectId?.name || '—',
                    sqft: sqftByWorkId.get(w._id.toString()) || 0,
                    estimatedAreaSqft: w.estimatedAreaSqft, completedAreaSqft: w.completedAreaSqft,
                    deductedAmount, expectedPay, expectedPayNetOfDeductions: round2(expectedPay - deductedAmount),
                };
            })
            .sort((a, b) => b.sqft - a.sqft);

        // Unscoped by project status (company-wide, matching getDashboardTrends'
        // already-correct 6-month chart and thisMonthRevenue below) — a
        // completed project's costs this month are still real costs; scoping
        // this to activeProjectIds only (as it used to) silently dropped a
        // just-completed project's cost from the same month its revenue
        // still counted, overstating This Month Profit.
        const [monthMaterialCost, monthContractorCost, monthCommissionCost, monthExpenseAgg, monthLabourCost, approvedBreakdown] = await Promise.all([
            computeCompanyWideMaterialCostInRange(monthStart, monthEnd),
            computeCompanyWideContractorCostInRange(monthStart, monthEnd),
            computeCompanyWideCommissionCostInRange(monthStart, monthEnd),
            FinanceExpense.aggregate([
                { $match: { date: { $gte: monthStart, $lte: monthEnd }, deleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            computeCompanyWideLabourCostInRange(monthStart, monthEnd),
            computeDashboardApprovedBreakdown(),
        ]);
        const thisMonthRevenue = monthRevenueAgg[0]?.total || 0;
        const thisMonthProfit = thisMonthRevenue - monthMaterialCost - monthContractorCost - monthCommissionCost
            - (monthExpenseAgg[0]?.total || 0) - monthLabourCost;

        res.json({
            success: true,
            data: {
                cashInBank, cashInHand,
                clientReceivables: (issuedAgg[0]?.total || 0) - (receivedAgg[0]?.total || 0),
                vendorPayables: vendorRows.reduce((s, r) => s + r.amountOwed, 0),
                contractorPayables: contractorRows.reduce((s, r) => s + r.balancePayable, 0),
                runningBillsReady: readyProjectIds.length,
                activeProjects: activeProjectsCount,
                activeWorks: activeWorksCount,
                labourWorkingToday: labourersWorkingTodayIds.length,
                materialLowAlerts: lowStockCount,
                todaysMeasurementSqft, todaysContractorMeasurementSqft, todaysLabourMeasurementSqft, todaysWorkActivity,
                approvedByWorkType: approvedBreakdown.byWorkType,
                approvedContractorTotal: approvedBreakdown.contractorTotal, approvedLabourTotal: approvedBreakdown.labourTotal,
                unapprovedByWorkType: approvedBreakdown.unapprovedByWorkType,
                unapprovedContractorTotal: approvedBreakdown.unapprovedContractorTotal, unapprovedLabourTotal: approvedBreakdown.unapprovedLabourTotal,
                thisMonthRevenue, thisMonthProfit,
                recentActivities,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing dashboard summary' });
    }
};

// Tier-0 charts: Revenue-vs-Cost by month (company-wide, last N months) and
// a 30-day daily cash flow series (reuses computeCashFlow directly).
const getDashboardTrends = async (req, res) => {
    try {
        const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 6));
        const now = new Date();
        const monthKeys = [];
        for (let i = months - 1; i >= 0; i--) {
            monthKeys.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7));
        }

        const revenueVsCost = await Promise.all(monthKeys.map(async (monthKey) => {
            const { start, end } = monthBounds(monthKey);
            const [revenueAgg, materialCost, contractorCost, commissionCost, expenseAgg, labourCost] = await Promise.all([
                FinanceRunningBill.aggregate([
                    { $match: { status: 'issued', billDate: { $gte: start, $lte: end }, deleted: { $ne: true } } },
                    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
                ]),
                computeCompanyWideMaterialCostInRange(start, end),
                computeCompanyWideContractorCostInRange(start, end),
                computeCompanyWideCommissionCostInRange(start, end),
                FinanceExpense.aggregate([
                    { $match: { date: { $gte: start, $lte: end }, deleted: { $ne: true } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ]),
                computeCompanyWideLabourCostInRange(start, end),
            ]);
            const revenue = revenueAgg[0]?.total || 0;
            const cost = materialCost + contractorCost + commissionCost + (expenseAgg[0]?.total || 0) + labourCost;
            return { month: monthKey, revenue, cost };
        }));

        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 29);
        const cashFlow = await computeCashFlow(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10), 'day');

        res.json({ success: true, data: { revenueVsCost, cashFlowSeries: cashFlow.series } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing dashboard trends' });
    }
};

// New Tier-1 endpoint for Clients — per-client billed/received/outstanding
// (grouped version of financeReceivable's logic) plus receivables aging.
const getClientsSummary = async (req, res) => {
    try {
        const clients = await FinanceClient.find({ deleted: { $ne: true } });
        // Every client shows up here, zeros and all — a client with no
        // billable projects yet has legitimately zero billed/received, same
        // as how getContractorsSummary/getVendorAnalysis/getInventorySummary
        // show every record regardless of activity rather than hiding it.
        const rows = await Promise.all(clients.map(async (c) => {
            const projects = await FinanceProject.find({ clientId: c._id, deleted: { $ne: true }, contractType: { $in: BILLABLE_CONTRACT_TYPES } }, '_id');
            const projectIds = projects.map(p => p._id);
            const [bills, receipts] = projectIds.length ? await Promise.all([
                FinanceRunningBill.find({ projectId: { $in: projectIds }, status: 'issued', deleted: { $ne: true } }).sort({ billDate: 1 }),
                FinanceReceipt.find({ projectId: { $in: projectIds }, deleted: { $ne: true } }),
            ]) : [[], []];
            const totalBilled = bills.reduce((s, b) => s + b.totalAmount, 0);
            const totalReceived = receipts.reduce((s, r) => s + r.amount, 0);
            return {
                clientId: c._id, clientName: c.name, totalBilled, totalReceived,
                outstanding: totalBilled - totalReceived, aging: computeAging(bills, receipts),
            };
        }));

        const data = rows.sort((a, b) => b.totalBilled - a.totalBilled);
        const aging = data.reduce((acc, r) => {
            for (const k of AGE_BUCKET_KEYS) acc[k] += r.aging[k];
            return acc;
        }, { '0-30': 0, '30-60': 0, '60-90': 0, '90+': 0 });

        res.json({ success: true, data: { clients: data, aging } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing clients summary' });
    }
};

// New Tier-2 endpoint for one client — profit rollup, per-project
// billed/received/outstanding, full receipt history, and this client's own
// aging breakdown.
const getClientDetail = async (req, res) => {
    try {
        const { clientId } = req.query;
        if (!clientId) return res.status(400).json({ success: false, message: 'clientId is required' });
        const client = await FinanceClient.findOne({ _id: clientId, deleted: { $ne: true } });
        if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

        const projects = await FinanceProject.find({ clientId, deleted: { $ne: true } });
        const perProject = (await Promise.all(projects.map(p => computeProjectProfit(p._id)))).filter(Boolean);
        const totals = perProject.reduce((acc, p) => ({
            revenue: acc.revenue + p.revenue, profit: acc.profit + p.profit,
        }), { revenue: 0, profit: 0 });
        const marginPercent = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

        const billableProjects = projects.filter(p => BILLABLE_CONTRACT_TYPES.includes(p.contractType));
        const projectIds = billableProjects.map(p => p._id);
        const [bills, receipts] = await Promise.all([
            FinanceRunningBill.find({ projectId: { $in: projectIds }, status: 'issued', deleted: { $ne: true } }).sort({ billDate: 1 }),
            FinanceReceipt.find({ projectId: { $in: projectIds }, deleted: { $ne: true } }).sort({ receiptDate: -1 }),
        ]);
        const totalBilled = bills.reduce((s, b) => s + b.totalAmount, 0);
        const totalReceived = receipts.reduce((s, r) => s + r.amount, 0);

        const projectsSummary = billableProjects.map(p => {
            const pBills = bills.filter(b => b.projectId.toString() === p._id.toString());
            const pReceipts = receipts.filter(r => r.projectId.toString() === p._id.toString());
            const billed = pBills.reduce((s, b) => s + b.totalAmount, 0);
            const received = pReceipts.reduce((s, r) => s + r.amount, 0);
            return { projectId: p._id, projectName: p.name, billed, received, outstanding: billed - received };
        });

        res.json({
            success: true,
            data: {
                clientId: client._id, clientName: client.name,
                totalBilled, totalReceived, outstanding: totalBilled - totalReceived, marginPercent,
                projects: projectsSummary, receipts, aging: computeAging(bills, receipts),
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing client detail' });
    }
};

/*
 * Shared by getCaMonthlyPackage (JSON) and downloadCaMonthlyPackage (PDF)
 * so the numbers on screen and in the PDF can never drift apart.
 *
 * INTERPRETATION FLAG: Output GST is scoped to status: 'issued' bills only
 * (not drafts) — consistent with every other "Revenue" figure in this
 * Reports module (Project/Client/Work Profit, Sales Summary below), all
 * of which treat an issued bill as the point money is actually owed.
 * Input GST has no such filter since the spec is explicit
 * (transactionType: 'purchase' only) and purchases have no draft state.
 */
const computeCaMonthlyPackage = async (month) => {
    const { start, end } = monthBounds(month);

    const issuedBills = await FinanceRunningBill.find({ billDate: { $gte: start, $lte: end }, status: 'issued', deleted: { $ne: true } });
    const outputGst = issuedBills.reduce((sum, b) => sum + (b.gstAmount || 0), 0);
    const salesTotal = issuedBills.reduce((sum, b) => sum + b.totalAmount, 0);

    const purchases = await FinancePurchase.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } });
    const purchaseRows = purchases.filter(p => p.transactionType === 'purchase');
    const returnRows = purchases.filter(p => p.transactionType === 'return');
    const inputGst = purchaseRows.reduce((sum, p) => sum + (p.gstAmount || 0), 0);
    const totalPurchased = purchaseRows.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalReturned = returnRows.reduce((sum, p) => sum + p.totalAmount, 0);

    const [contractorPayments, vendorPayments, commissionPayments] = await Promise.all([
        FinanceContractorPayment.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } }),
        FinanceVendorPayment.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } }),
        FinanceCommissionPayment.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } }),
    ]);
    const allPayments = [...contractorPayments, ...vendorPayments, ...commissionPayments];
    const tdsSectionIds = [...new Set(allPayments.filter(p => p.tdsSectionId).map(p => p.tdsSectionId.toString()))];
    const tdsSections = tdsSectionIds.length ? await FinanceSetting.find({ _id: { $in: tdsSectionIds } }) : [];
    const sectionById = new Map(tdsSections.map(s => [s._id.toString(), s]));
    const tdsBySection = new Map();
    let totalTds = 0;
    for (const p of allPayments) {
        if (!p.tdsAmount) continue;
        totalTds += p.tdsAmount;
        const key = p.tdsSectionId ? p.tdsSectionId.toString() : 'unspecified';
        if (!tdsBySection.has(key)) {
            const section = sectionById.get(key);
            tdsBySection.set(key, { tdsSectionId: p.tdsSectionId || null, tdsSectionName: section?.name || 'Unspecified', tdsSectionCode: section?.code || '', totalTds: 0 });
        }
        tdsBySection.get(key).totalTds += p.tdsAmount;
    }

    const expenses = await FinanceExpense.find({ date: { $gte: start, $lte: end }, deleted: { $ne: true } });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const bankAccounts = await FinanceBankAccount.find({ deleted: { $ne: true } });
    const bankPositions = await Promise.all(bankAccounts.map(async (a) => {
        const activity = await getAccountActivity(a._id);
        const net = activity.filter(t => new Date(t.date) <= end).reduce((sum, t) => sum + (t.direction === 'credit' ? t.amount : -t.amount), 0);
        return { accountId: a._id, accountName: a.accountName, closingBalance: a.openingBalance + net };
    }));
    const totalBankBalance = bankPositions.reduce((sum, b) => sum + b.closingBalance, 0);

    const cashEntries = await FinanceCashEntry.find({ deleted: { $ne: true }, date: { $lte: end } });
    const cashClosingBalance = cashEntries.reduce((sum, e) => sum + (e.type === 'in' ? e.amount : -e.amount), 0);

    return {
        month,
        gst: { outputGst, inputGst, netGstPayable: outputGst - inputGst },
        tds: { totalTds, bySection: [...tdsBySection.values()].sort((a, b) => b.totalTds - a.totalTds) },
        sales: { totalBilled: salesTotal, billCount: issuedBills.length },
        purchases: { totalPurchased, totalReturned, netPurchases: totalPurchased - totalReturned, purchaseCount: purchaseRows.length },
        expenses: { totalExpenses, expenseCount: expenses.length },
        bankAndCash: { bankAccounts: bankPositions, totalBankBalance, cashClosingBalance, totalPosition: totalBankBalance + cashClosingBalance },
    };
};

const getCaMonthlyPackage = async (req, res) => {
    try {
        const { month } = req.query;
        if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ success: false, message: 'month is required in YYYY-MM format' });
        const data = await computeCaMonthlyPackage(month);
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing CA monthly package' });
    }
};

const downloadCaMonthlyPackage = async (req, res) => {
    try {
        const { month } = req.query;
        if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ success: false, message: 'month is required in YYYY-MM format' });
        const data = await computeCaMonthlyPackage(month);
        const company = await getCompanyForPdf();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="CA-Monthly-Package-${month}.pdf"`);

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);
        doc.on('pageAdded', () => paintPageBackground(doc));
        paintPageBackground(doc);

        await writeLetterhead(doc, `CA Monthly Package — ${month}`, company);
        doc.font('Helvetica').fontSize(9).fillColor('#555555')
            .text('For handoff to your CA — these are computed figures, not a filed return. GST/TDS amounts reflect only what was entered against bills, purchases, and payments this month.');
        doc.fillColor('#000000');

        writeSectionHeading(doc, 'GST Summary');
        doc.text(`Output GST (from issued bills): ${formatCurrency(data.gst.outputGst)}`);
        doc.text(`Input GST (from purchases): ${formatCurrency(data.gst.inputGst)}`);
        doc.font('Helvetica-Bold').text(`Net GST Payable: ${formatCurrency(data.gst.netGstPayable)}`).font('Helvetica');

        writeSectionHeading(doc, 'TDS Summary');
        if (data.tds.bySection.length === 0) {
            doc.text('No TDS recorded this month.');
        } else {
            data.tds.bySection.forEach(s => doc.text(`${s.tdsSectionName}${s.tdsSectionCode ? ` (${s.tdsSectionCode})` : ''}: ${formatCurrency(s.totalTds)}`));
            doc.font('Helvetica-Bold').text(`Total TDS: ${formatCurrency(data.tds.totalTds)}`).font('Helvetica');
        }

        writeSectionHeading(doc, 'Sales Summary');
        doc.text(`Total Billed (issued bills): ${formatCurrency(data.sales.totalBilled)}`);
        doc.text(`Bill Count: ${data.sales.billCount}`);

        writeSectionHeading(doc, 'Purchase Summary');
        doc.text(`Total Purchased: ${formatCurrency(data.purchases.totalPurchased)}`);
        doc.text(`Total Returned: ${formatCurrency(data.purchases.totalReturned)}`);
        doc.text(`Net Purchases: ${formatCurrency(data.purchases.netPurchases)}`);
        doc.text(`Purchase Count: ${data.purchases.purchaseCount}`);

        writeSectionHeading(doc, 'Expense Summary');
        doc.text(`Total Expenses: ${formatCurrency(data.expenses.totalExpenses)}`);
        doc.text(`Expense Count: ${data.expenses.expenseCount}`);

        writeSectionHeading(doc, 'Bank & Cash Position (as of month end)');
        data.bankAndCash.bankAccounts.forEach(a => doc.text(`${a.accountName}: ${formatCurrency(a.closingBalance)}`));
        doc.text(`Cash: ${formatCurrency(data.bankAndCash.cashClosingBalance)}`);
        doc.font('Helvetica-Bold').text(`Total Position: ${formatCurrency(data.bankAndCash.totalPosition)}`).font('Helvetica');

        writeFooter(doc, company);
        doc.end();
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating CA monthly package PDF' });
    }
};

export {
    getProjectProfit, getClientProfit, getWorkProfit, getWorkDetail,
    getContractorAnalysis, getContractorsSummary, getLabourAnalysis,
    getVendorAnalysis, getVendorsSummary,
    getMaterialAnalysis, getInventorySummary,
    getCashFlow, getExpenseAnalysis,
    getCaMonthlyPackage, downloadCaMonthlyPackage,
    getDashboardSummary, getDashboardTrends,
    getClientsSummary, getClientDetail,
    // Shared with financeContractorLedger.js/financeLabourLedger.js so the
    // "approved = billed to client via an issued running bill" figure and
    // its multi-party proportional split never drift between this module
    // and those (same cross-controller import pattern already used
    // elsewhere in this codebase, e.g. financeMeasurement.js importing
    // computeCurrentStock from financeStockMovement.js).
    getApprovedBillingByWorkId, splitApprovedAreaByShare, computeWorkExpectedPay,
    // Shared with financeProject.js's completion-readiness endpoint + the
    // "Mark Completed" action itself — same reasoning as the export above.
    getProjectCompletionReadiness,
};
