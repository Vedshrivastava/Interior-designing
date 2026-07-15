import mongoose from 'mongoose';
import FinanceProject from '../models/financeProject.js';
import FinanceClient from '../models/financeClient.js';
import FinanceVendor from '../models/financeVendor.js';
import FinanceTeam from '../models/financeTeam.js';
import FinanceWork from '../models/financeWork.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceTeamRate from '../models/financeTeamRate.js';
import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import FinanceRunningBill from '../models/financeRunningBill.js';
import FinancePurchase from '../models/financePurchase.js';
import FinanceStockMovement from '../models/financeStockMovement.js';
import FinanceMaterial from '../models/financeMaterial.js';
import FinanceReceipt from '../models/financeReceipt.js';
import FinanceExpense from '../models/financeExpense.js';
import FinanceContractorAdvance from '../models/financeContractorAdvance.js';
import FinanceContractorDeduction from '../models/financeContractorDeduction.js';
import FinanceContractorPayment from '../models/financeContractorPayment.js';
import FinanceVendorPayment from '../models/financeVendorPayment.js';
import FinanceSalaryPayment from '../models/financeSalaryPayment.js';
import FinanceCommissionPayment from '../models/financeCommissionPayment.js';
import FinanceDailyLabour from '../models/financeDailyLabour.js';
import FinanceSetting from '../models/financeSetting.js';
import FinanceBankAccount from '../models/financeBankAccount.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import FinanceActivityLog from '../models/financeActivityLog.js';
import { getAccountActivity } from './financeBankAccount.js';
import PDFDocument from 'pdfkit';
import { writeLetterhead, writeSectionHeading, writeFooter, formatCurrency, formatDate } from '../utils/pdfLetterhead.js';
import FinanceCompanySettings from '../models/financeCompanySettings.js';
import { getAssignmentsByWork, getTeamIdsForWork, findWorkIdsForTeams, resolveMeasurementTeamId } from '../utils/workTeamAssignments.js';

// totalArea − approvedArea on floats accumulated across many measurements
// produces artifacts like 21.300000000000001 — round for display/storage.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// .lean() — spreading a hydrated Mongoose document ({ ...doc }) silently
// drops some schema fields (companyName among them), since document
// instances aren't plain objects. A lean query avoids that footgun.
const getCompanyForPdf = async () => (await FinanceCompanySettings.findOne({ deleted: { $ne: true } }).lean()) || null;

const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material'];

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

// Measurement-level: each day's area attributes to whichever team actually
// did it (a Work can have more than one team/contractor contributing).
// Contractor cost = only engineer-approved area — unapproved measurements
// aren't a confirmed payable liability yet, same gate financeRunningBill
// applies for client billing (see financeContractorLedger.js's header note).
const computeProjectContractorCost = async (projectId) => {
    const works = await FinanceWork.find({ projectId, deleted: { $ne: true } });
    if (!works.length) return 0;
    const workById = new Map(works.map(w => [w._id.toString(), w]));
    const measurements = await FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, engineerApproved: true, deleted: { $ne: true } });
    if (!measurements.length) return 0;

    const teamIds = new Set();
    const areaByTeamWorkType = new Map(); // `${teamId}_${workType}` -> area
    for (const m of measurements) {
        const work = workById.get(m.workId.toString());
        const { teamId } = resolveMeasurementTeamId(m, work);
        if (!teamId) continue;
        teamIds.add(teamId.toString());
        const key = `${teamId}_${work.workType}`;
        areaByTeamWorkType.set(key, (areaByTeamWorkType.get(key) || 0) + m.areaCoveredSqft);
    }
    if (!areaByTeamWorkType.size) return 0;

    const rates = await FinanceTeamRate.find({ projectId, teamId: { $in: [...teamIds] }, deleted: { $ne: true } });
    const rateByKey = new Map(rates.map(r => [`${r.teamId}_${r.workType}`, r]));
    let total = 0;
    for (const [key, area] of areaByTeamWorkType) {
        const rate = rateByKey.get(key);
        if (rate) total += area * (rate.paymentBasis === 'per_day' ? rate.ratePerDay : rate.ratePerSqft);
    }
    return total;
};

const computeProjectCommissionCost = async (project) => {
    if (!project.referralVendorId) return 0;
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

    const [revenueAgg, materialCost, contractorCost, commissionCost, expenseAgg, dailyLabourAgg] = await Promise.all([
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
        FinanceDailyLabour.aggregate([
            { $match: { projectId: project._id, deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);

    const revenue = revenueAgg[0]?.total || 0;
    const otherExpenses = expenseAgg[0]?.total || 0;
    const dailyLabourCost = dailyLabourAgg[0]?.total || 0;
    const profit = revenue - materialCost - contractorCost - commissionCost - otherExpenses - dailyLabourCost;

    return {
        projectId: project._id, projectName: project.name, clientId: project.clientId,
        revenue, materialCost, contractorCost, commissionCost, otherExpenses, dailyLabourCost, profit,
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
            dailyLabourCost: acc.dailyLabourCost + p.dailyLabourCost,
            profit: acc.profit + p.profit,
        }), { revenue: 0, materialCost: 0, contractorCost: 0, commissionCost: 0, otherExpenses: 0, dailyLabourCost: 0, profit: 0 });
        totals.marginPercent = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

        res.json({ success: true, data: { clientId: client._id, clientName: client.name, projects: perProject, totals } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing client profit' });
    }
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
    // whichever team actually did it, so a Work with more than one
    // contributing team gets a per-team breakdown, not one blended rate.
    // `contractorCost` stays the summed total so nothing reading only that
    // field breaks.
    const measurements = await FinanceMeasurement.find({ workId: work._id, deleted: { $ne: true } });
    const areaByTeam = new Map(); // teamId -> { totalArea, approvedArea, isLegacyAttribution }
    for (const m of measurements) {
        const { teamId, isLegacyAttribution } = resolveMeasurementTeamId(m, work);
        if (!teamId) continue;
        const key = teamId.toString();
        const cur = areaByTeam.get(key) || { totalArea: 0, approvedArea: 0, isLegacyAttribution: false };
        cur.totalArea += m.areaCoveredSqft;
        if (m.engineerApproved) cur.approvedArea += m.areaCoveredSqft;
        cur.isLegacyAttribution = cur.isLegacyAttribution || isLegacyAttribution;
        areaByTeam.set(key, cur);
    }
    // Seed teams with zero area too, so a brand-new Work with a team
    // assigned but no measurements yet still shows a (zero) breakdown row.
    const assignmentsByWorkId = await getAssignmentsByWork([work._id]);
    for (const t of getTeamIdsForWork(work, assignmentsByWorkId)) {
        const key = t.toString();
        if (!areaByTeam.has(key)) areaByTeam.set(key, { totalArea: 0, approvedArea: 0, isLegacyAttribution: false });
    }

    // contractorCost only counts approved area — unapproved ("neglected")
    // area is reported per-row (neglectedAreaSqft/neglectedAmount) but
    // excluded from cost/profit, same gate the Contractor Ledger applies.
    let contractorCost = 0;
    const contractorBreakdown = [];
    if (areaByTeam.size) {
        const teamIds = [...areaByTeam.keys()];
        const [rates, teams] = await Promise.all([
            FinanceTeamRate.find({ projectId: work.projectId, teamId: { $in: teamIds }, workType: work.workType, deleted: { $ne: true } }),
            FinanceTeam.find({ _id: { $in: teamIds }, deleted: { $ne: true } }).populate('contractorVendorId', 'name'),
        ]);
        const rateByTeam = new Map(rates.map(r => [r.teamId.toString(), r]));
        const teamById = new Map(teams.map(t => [t._id.toString(), t]));
        for (const [teamId, { totalArea, approvedArea, isLegacyAttribution }] of areaByTeam) {
            const rate = rateByTeam.get(teamId);
            const perUnit = rate ? (rate.paymentBasis === 'per_day' ? rate.ratePerDay : rate.ratePerSqft) : 0;
            const neglectedArea = round2(totalArea - approvedArea);
            const earnings = round2(approvedArea * perUnit);
            const neglectedAmount = round2(neglectedArea * perUnit);
            contractorCost += earnings;
            const team = teamById.get(teamId);
            contractorBreakdown.push({
                teamId, teamName: team?.name || '—', vendorName: team?.contractorVendorId?.name || '—',
                areaSqft: round2(totalArea), approvedAreaSqft: round2(approvedArea), neglectedAreaSqft: neglectedArea,
                rate: perUnit, earnings, neglectedAmount, isLegacyAttribution,
            });
        }
    }

    contractorCost = round2(contractorCost);
    const materialCost = await computeWorkMaterialCost(work.projectId, work._id);
    const profit = revenue - contractorCost - materialCost;

    return { revenue, contractorCost, contractorBreakdown, materialCost, profit, areaBilledSqft };
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
                materialCost: wp.materialCost, profit: wp.profit,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing work profit' });
    }
};

// New Tier-2 endpoint — everything about one work for one month.
const getWorkDetail = async (req, res) => {
    try {
        const { workId, month } = req.query;
        if (!workId) return res.status(400).json({ success: false, message: 'workId is required' });
        const work = await FinanceWork.findOne({ _id: workId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found' });

        const monthKey = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
        const { start, end } = monthBounds(monthKey);
        const progressPercent = work.estimatedAreaSqft > 0 ? Math.min(100, Math.round((work.completedAreaSqft / work.estimatedAreaSqft) * 100)) : 0;

        const [measurements, materials, taggedWaste, projectWasteTotal, avgRate, workProfit] = await Promise.all([
            FinanceMeasurement.find({ workId, deleted: { $ne: true } }).sort({ date: 1 }),
            FinanceMaterial.find({ deleted: { $ne: true } }, 'name unit'),
            FinanceStockMovement.aggregate([
                { $match: { workId: new mongoose.Types.ObjectId(workId), movementType: 'waste', deleted: { $ne: true } } },
                { $group: { _id: '$materialId', qty: { $sum: '$quantity' } } },
            ]),
            // Untagged waste at this project — reported separately, honestly,
            // rather than silently folded into or excluded from this work's number.
            FinanceStockMovement.aggregate([
                { $match: { projectId: work.projectId, movementType: 'waste', workId: null, deleted: { $ne: true } } },
                { $group: { _id: '$materialId', qty: { $sum: '$quantity' } } },
            ]),
            computeMaterialAvgRates(work.projectId),
            computeWorkProfit(work),
        ]);
        const materialById = new Map(materials.map(m => [m._id.toString(), m]));
        const nameUnit = (id) => ({ materialName: materialById.get(id.toString())?.name || 'Unknown', unit: materialById.get(id.toString())?.unit || '' });

        // Material Used — traced via each measurement's own materialUsed[],
        // not re-derived from stock movements (measurements already store it).
        const usedByMaterial = new Map();
        for (const m of measurements) {
            for (const u of m.materialUsed) {
                const key = u.materialId.toString();
                usedByMaterial.set(key, (usedByMaterial.get(key) || 0) + u.quantity);
            }
        }
        const materialUsed = [...usedByMaterial.entries()].map(([id, qty]) => ({ materialId: id, quantity: qty, ...nameUnit(id) }));
        const materialWasted = taggedWaste.map(r => ({ materialId: r._id, quantity: r.qty, ...nameUnit(r._id) }));
        const projectLevelWaste = projectWasteTotal.map(r => ({ materialId: r._id, quantity: r.qty, ...nameUnit(r._id) }));

        // Daily breakdown + Average Cost/Sqft (month) = mean of each day's
        // costPerSqft, NOT totalMaterialCost / totalArea — days with zero
        // material cost recorded are skipped, not counted as a zero ratio.
        const byDate = new Map();
        for (const m of measurements) {
            if (m.date < start || m.date > end) continue;
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

        res.json({
            success: true,
            data: {
                workId: work._id, projectId: work.projectId, workType: work.workType,
                estimatedAreaSqft: work.estimatedAreaSqft, completedAreaSqft: work.completedAreaSqft, progressPercent,
                materialUsed, materialWasted, projectLevelWaste,
                month: monthKey, dailyBreakdown, averageCostPerSqft,
                contractorCost: workProfit.contractorCost, contractorBreakdown: workProfit.contractorBreakdown,
                revenue: workProfit.revenue, profit: workProfit.profit,
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
        const teams = await FinanceTeam.find({ contractorVendorId: v._id, deleted: { $ne: true } });
        const teamIds = teams.map(t => t._id);
        const teamIdSet = new Set(teamIds.map(t => t.toString()));

        const workIds = teamIds.length ? await findWorkIdsForTeams(teamIds) : [];
        const workFilter = { _id: { $in: workIds }, deleted: { $ne: true } };
        if (projectId) workFilter.projectId = projectId;
        const works = workIds.length ? await FinanceWork.find(workFilter) : [];
        const workById = new Map(works.map(w => [w._id.toString(), w]));

        const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
        const [rates, measurements] = await Promise.all([
            projectIds.length
                ? FinanceTeamRate.find({ projectId: { $in: projectIds }, teamId: { $in: teamIds }, deleted: { $ne: true } })
                : [],
            works.length
                ? FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, engineerApproved: true, deleted: { $ne: true } })
                : [],
        ]);
        const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.teamId}_${r.workType}`, r]));

        // Measurement-level: each day's area attributes to whichever of this
        // contractor's teams actually did it (a Work can have another
        // contractor's team on it too, or the same contractor's teams split
        // across days). Only engineer-approved area counts as earnings.
        const areaByKey = new Map(); // `${projectId}_${teamId}_${workType}` -> area
        for (const m of measurements) {
            const work = workById.get(m.workId.toString());
            const { teamId } = resolveMeasurementTeamId(m, work);
            if (!teamId || !teamIdSet.has(teamId.toString())) continue;
            const key = `${work.projectId}_${teamId}_${work.workType}`;
            areaByKey.set(key, (areaByKey.get(key) || 0) + m.areaCoveredSqft);
        }
        let earnings = 0;
        for (const [key, area] of areaByKey) {
            const rate = rateByKey.get(key);
            if (rate) earnings += area * (rate.paymentBasis === 'per_day' ? rate.ratePerDay : rate.ratePerSqft);
        }

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

        return { vendorId: v._id, vendorName: v.name, earnings, advances: advancesTotal, deductions: deductionsTotal, payments: paymentsTotal, balancePayable };
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
                const teams = await FinanceTeam.find({ contractorVendorId: v._id, deleted: { $ne: true } });
                const teamIds = teams.map(t => t._id);
                const teamIdSet = new Set(teamIds.map(t => t.toString()));
                if (!teamIds.length) return { vendorId: v._id, vendorName: v.name, byWorkType: [] };

                const workIds = await findWorkIdsForTeams(teamIds);
                const workFilter = { _id: { $in: workIds }, deleted: { $ne: true } };
                if (projectId) workFilter.projectId = projectId;
                const works = await FinanceWork.find(workFilter);
                if (!works.length) return { vendorId: v._id, vendorName: v.name, byWorkType: [] };
                const workById = new Map(works.map(w => [w._id.toString(), w]));

                const [rates, measurements] = await Promise.all([
                    FinanceTeamRate.find({ projectId: { $in: [...new Set(works.map(w => w.projectId.toString()))] }, teamId: { $in: teamIds }, deleted: { $ne: true } }),
                    FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, engineerApproved: true, deleted: { $ne: true } }),
                ]);
                const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.teamId}_${r.workType}`, r]));

                // Measurement-level, restricted to this contractor's own teams.
                const byType = new Map();
                for (const m of measurements) {
                    const work = workById.get(m.workId.toString());
                    const { teamId } = resolveMeasurementTeamId(m, work);
                    if (!teamId || !teamIdSet.has(teamId.toString())) continue;
                    const rate = rateByKey.get(`${work.projectId}_${teamId}_${work.workType}`);
                    const earnings = rate ? m.areaCoveredSqft * (rate.paymentBasis === 'per_day' ? rate.ratePerDay : rate.ratePerSqft) : 0;
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
        const { projectId, category, from, to } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        if (category) filter.expenseCategory = category;
        if (from || to) {
            filter.date = {};
            if (from) filter.date.$gte = new Date(from);
            if (to) filter.date.$lte = new Date(to);
        }
        const expenses = await FinanceExpense.find(filter).populate('projectId', 'name').sort({ date: -1 });
        const total = expenses.reduce((s, e) => s + e.amount, 0);

        const byCategoryMap = new Map();
        const byProjectMap = new Map();
        for (const e of expenses) {
            const cat = e.expenseCategory || 'Uncategorized';
            byCategoryMap.set(cat, (byCategoryMap.get(cat) || 0) + e.amount);

            const projKey = e.projectId ? e.projectId._id.toString() : 'general';
            const projName = e.projectId ? e.projectId.name : 'General / overhead';
            if (!byProjectMap.has(projKey)) byProjectMap.set(projKey, { projectId: e.projectId?._id || null, projectName: projName, amount: 0 });
            byProjectMap.get(projKey).amount += e.amount;
        }

        res.json({
            success: true,
            data: {
                total,
                byCategory: [...byCategoryMap.entries()].map(([cat, amount]) => ({ category: cat, amount })).sort((a, b) => b.amount - a.amount),
                byProject: [...byProjectMap.values()].sort((a, b) => b.amount - a.amount),
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
// project-progress chart relies on.
const computeCompanyWideContractorCostInRange = async (start, end, projectIds = null) => {
    const match = { date: { $gte: start, $lte: end }, engineerApproved: true, deleted: { $ne: true } };
    const measurements = await FinanceMeasurement.find(match).populate({ path: 'workId', select: 'projectId teamId workType' });
    const relevant = measurements.filter(m => m.workId && (!projectIds || projectIds.some(id => id.toString() === m.workId.projectId.toString())));
    if (!relevant.length) return 0;

    // Grouping key is (work, resolved team) rather than work alone, so a
    // Work with more than one contributing team splits correctly.
    const areaByWorkTeam = new Map(); // `${workId}_${teamId}` -> area
    const workById = new Map();
    const teamIds = new Set();
    for (const m of relevant) {
        const work = m.workId;
        const { teamId } = resolveMeasurementTeamId(m, work);
        if (!teamId) continue;
        const key = `${work._id}_${teamId}`;
        areaByWorkTeam.set(key, (areaByWorkTeam.get(key) || 0) + m.areaCoveredSqft);
        workById.set(work._id.toString(), work);
        teamIds.add(teamId.toString());
    }
    if (!areaByWorkTeam.size) return 0;

    const works = [...workById.values()];
    const projIds = [...new Set(works.map(w => w.projectId.toString()))];
    const rates = await FinanceTeamRate.find({ projectId: { $in: projIds }, teamId: { $in: [...teamIds] }, deleted: { $ne: true } });
    const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.teamId}_${r.workType}`, r]));

    let total = 0;
    for (const [key, area] of areaByWorkTeam) {
        const [workId, teamId] = key.split('_');
        const w = workById.get(workId);
        const rate = rateByKey.get(`${w.projectId}_${teamId}_${w.workType}`);
        if (rate) total += area * (rate.paymentBasis === 'per_day' ? rate.ratePerDay : rate.ratePerSqft);
    }
    return total;
};

// Same measurement-date proxy as the contractor-cost helper above, scoped
// to projects that actually have a referral vendor (commission only applies
// there).
const computeCompanyWideCommissionCostInRange = async (start, end, projectIds = null) => {
    const match = { date: { $gte: start, $lte: end }, deleted: { $ne: true } };
    const measurements = await FinanceMeasurement.find(match).populate({ path: 'workId', select: 'projectId workType' });
    const relevant = measurements.filter(m => m.workId && (!projectIds || projectIds.some(id => id.toString() === m.workId.projectId.toString())));
    if (!relevant.length) return 0;

    const candidateProjectIds = [...new Set(relevant.map(m => m.workId.projectId.toString()))];
    const referralProjects = await FinanceProject.find({ _id: { $in: candidateProjectIds }, referralVendorId: { $ne: null } }, '_id');
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

        const [
            bankAccounts, cashEntriesToDate, issuedAgg, receivedAgg, contractorRows, vendorRows,
            readyProjectIds, activeProjectsCount, activeWorksCount, labourTodayCount, lowStockCount,
            todayMeasurementAgg, monthRevenueAgg, recentActivities,
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
            FinanceMeasurement.distinct('projectId', { engineerApproved: true, billedInRunningBillId: null, deleted: { $ne: true } }),
            FinanceProject.countDocuments({ status: 'active', deleted: { $ne: true } }),
            FinanceWork.countDocuments({ status: 'active', deleted: { $ne: true } }),
            FinanceDailyLabour.countDocuments({ date: { $gte: todayStart, $lte: todayEnd }, deleted: { $ne: true } }),
            computeLowStockMaterialCount(activeProjectIds),
            FinanceMeasurement.aggregate([
                { $match: { date: { $gte: todayStart, $lte: todayEnd }, deleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: '$areaCoveredSqft' } } },
            ]),
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

        const [monthMaterialCost, monthContractorCost, monthCommissionCost, monthExpenseAgg, monthDailyLabourAgg] = await Promise.all([
            computeCompanyWideMaterialCostInRange(monthStart, monthEnd, activeProjectIds),
            computeCompanyWideContractorCostInRange(monthStart, monthEnd, activeProjectIds),
            computeCompanyWideCommissionCostInRange(monthStart, monthEnd, activeProjectIds),
            FinanceExpense.aggregate([
                { $match: { projectId: { $in: activeProjectIds }, date: { $gte: monthStart, $lte: monthEnd }, deleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            FinanceDailyLabour.aggregate([
                { $match: { projectId: { $in: activeProjectIds }, date: { $gte: monthStart, $lte: monthEnd }, deleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
        ]);
        const thisMonthRevenue = monthRevenueAgg[0]?.total || 0;
        const thisMonthProfit = thisMonthRevenue - monthMaterialCost - monthContractorCost - monthCommissionCost
            - (monthExpenseAgg[0]?.total || 0) - (monthDailyLabourAgg[0]?.total || 0);

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
                labourWorkingToday: labourTodayCount,
                materialLowAlerts: lowStockCount,
                todaysMeasurementSqft: todayMeasurementAgg[0]?.total || 0,
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
            const [revenueAgg, materialCost, contractorCost, commissionCost, expenseAgg, dailyLabourAgg] = await Promise.all([
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
                FinanceDailyLabour.aggregate([
                    { $match: { date: { $gte: start, $lte: end }, deleted: { $ne: true } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ]),
            ]);
            const revenue = revenueAgg[0]?.total || 0;
            const cost = materialCost + contractorCost + commissionCost + (expenseAgg[0]?.total || 0) + (dailyLabourAgg[0]?.total || 0);
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

        await writeLetterhead(doc, `CA Monthly Package — ${month}`, company);
        doc.font('Helvetica').fontSize(9).fillColor('#555555')
            .text('For handoff to your CA — these are computed figures, not a filed return. GST/TDS amounts reflect only what was entered against bills, purchases, and payments this month.');
        doc.fillColor('#000000');

        writeSectionHeading(doc, 'GST Summary', company);
        doc.text(`Output GST (from issued bills): ${formatCurrency(data.gst.outputGst)}`);
        doc.text(`Input GST (from purchases): ${formatCurrency(data.gst.inputGst)}`);
        doc.font('Helvetica-Bold').text(`Net GST Payable: ${formatCurrency(data.gst.netGstPayable)}`).font('Helvetica');

        writeSectionHeading(doc, 'TDS Summary', company);
        if (data.tds.bySection.length === 0) {
            doc.text('No TDS recorded this month.');
        } else {
            data.tds.bySection.forEach(s => doc.text(`${s.tdsSectionName}${s.tdsSectionCode ? ` (${s.tdsSectionCode})` : ''}: ${formatCurrency(s.totalTds)}`));
            doc.font('Helvetica-Bold').text(`Total TDS: ${formatCurrency(data.tds.totalTds)}`).font('Helvetica');
        }

        writeSectionHeading(doc, 'Sales Summary', company);
        doc.text(`Total Billed (issued bills): ${formatCurrency(data.sales.totalBilled)}`);
        doc.text(`Bill Count: ${data.sales.billCount}`);

        writeSectionHeading(doc, 'Purchase Summary', company);
        doc.text(`Total Purchased: ${formatCurrency(data.purchases.totalPurchased)}`);
        doc.text(`Total Returned: ${formatCurrency(data.purchases.totalReturned)}`);
        doc.text(`Net Purchases: ${formatCurrency(data.purchases.netPurchases)}`);
        doc.text(`Purchase Count: ${data.purchases.purchaseCount}`);

        writeSectionHeading(doc, 'Expense Summary', company);
        doc.text(`Total Expenses: ${formatCurrency(data.expenses.totalExpenses)}`);
        doc.text(`Expense Count: ${data.expenses.expenseCount}`);

        writeSectionHeading(doc, 'Bank & Cash Position (as of month end)', company);
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
    getContractorAnalysis, getContractorsSummary,
    getVendorAnalysis, getVendorsSummary,
    getMaterialAnalysis, getInventorySummary,
    getCashFlow, getExpenseAnalysis,
    getCaMonthlyPackage, downloadCaMonthlyPackage,
    getDashboardSummary, getDashboardTrends,
    getClientsSummary, getClientDetail,
};
