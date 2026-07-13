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
import { getAccountActivity } from './financeBankAccount.js';
import PDFDocument from 'pdfkit';
import { writeLetterhead, writeSectionHeading, writeFooter, formatCurrency, formatDate } from '../utils/pdfLetterhead.js';
import FinanceCompanySettings from '../models/financeCompanySettings.js';

// .lean() — spreading a hydrated Mongoose document ({ ...doc }) silently
// drops some schema fields (companyName among them), since document
// instances aren't plain objects. A lean query avoids that footgun.
const getCompanyForPdf = async () => (await FinanceCompanySettings.findOne({ deleted: { $ne: true } }).lean()) || null;

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

const computeProjectContractorCost = async (projectId) => {
    const works = await FinanceWork.find({ projectId, deleted: { $ne: true } });
    if (!works.length) return 0;
    const teamIds = [...new Set(works.map(w => w.teamId.toString()))];
    const rates = await FinanceTeamRate.find({ projectId, teamId: { $in: teamIds }, deleted: { $ne: true } });
    const rateByKey = new Map(rates.map(r => [`${r.teamId}_${r.workType}`, r]));
    let total = 0;
    for (const w of works) {
        const rate = rateByKey.get(`${w.teamId}_${w.workType}`);
        if (rate) total += w.completedAreaSqft * (rate.paymentBasis === 'per_day' ? rate.ratePerDay : rate.ratePerSqft);
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

// Shared by getProjectProfit and getClientProfit (which sums this across
// every project belonging to a client).
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

const getProjectProfit = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const data = await computeProjectProfit(projectId);
        if (!data) return res.status(404).json({ success: false, message: 'Project not found' });
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

// INTERPRETATION FLAG: the spec's revenue formula for Work Profit doesn't
// explicitly say to filter by bill status the way Project Profit does. To
// keep "Revenue" meaning the same thing everywhere in this module (money
// actually billed to the client, not a draft that could still change),
// this filters to status: 'issued' too — flip this filter here only if
// that turns out to be the wrong call.
const getWorkProfit = async (req, res) => {
    try {
        const { workId } = req.query;
        if (!workId) return res.status(400).json({ success: false, message: 'workId is required' });
        const work = await FinanceWork.findOne({ _id: workId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found' });

        const revenueAgg = await FinanceRunningBill.aggregate([
            { $match: { status: 'issued', deleted: { $ne: true } } },
            { $unwind: '$lineItems' },
            { $match: { 'lineItems.workId': work._id } },
            { $group: { _id: null, amount: { $sum: '$lineItems.amount' }, areaBilledSqft: { $sum: '$lineItems.areaBilledSqft' } } },
        ]);
        const revenue = revenueAgg[0]?.amount || 0;
        const areaBilledSqft = revenueAgg[0]?.areaBilledSqft || 0;

        const rate = await FinanceTeamRate.findOne({ projectId: work.projectId, teamId: work.teamId, workType: work.workType, deleted: { $ne: true } });
        const contractorCost = rate ? work.completedAreaSqft * (rate.paymentBasis === 'per_day' ? rate.ratePerDay : rate.ratePerSqft) : 0;

        const materialCost = await computeWorkMaterialCost(work.projectId, work._id);
        const profit = revenue - contractorCost - materialCost;

        res.json({
            success: true,
            data: {
                workId: work._id, projectId: work.projectId, teamId: work.teamId, workType: work.workType,
                estimatedAreaSqft: work.estimatedAreaSqft, completedAreaSqft: work.completedAreaSqft, areaBilledSqft,
                revenue, contractorCost, materialCost, profit,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing work profit' });
    }
};

const getContractorAnalysis = async (req, res) => {
    try {
        const { projectId } = req.query;
        const contractors = await FinanceVendor.find({ vendorType: 'labour_contractor', deleted: { $ne: true } });

        const rows = await Promise.all(contractors.map(async (v) => {
            const teams = await FinanceTeam.find({ contractorVendorId: v._id, deleted: { $ne: true } });
            const teamIds = teams.map(t => t._id);

            const workFilter = { teamId: { $in: teamIds }, deleted: { $ne: true } };
            if (projectId) workFilter.projectId = projectId;
            const works = teamIds.length ? await FinanceWork.find(workFilter) : [];

            const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
            const rates = projectIds.length
                ? await FinanceTeamRate.find({ projectId: { $in: projectIds }, teamId: { $in: teamIds }, deleted: { $ne: true } })
                : [];
            const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.teamId}_${r.workType}`, r]));

            let earnings = 0;
            for (const w of works) {
                const rate = rateByKey.get(`${w.projectId}_${w.teamId}_${w.workType}`);
                if (rate) earnings += w.completedAreaSqft * (rate.paymentBasis === 'per_day' ? rate.ratePerDay : rate.ratePerSqft);
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

        res.json({ success: true, data: rows.sort((a, b) => b.balancePayable - a.balancePayable) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing contractor analysis' });
    }
};

// INTERPRETATION FLAG: scoped strictly to vendorType 'material_supplier',
// not the broader "every non-contractor vendor" filter Payables' Vendor
// tab uses — referral vendors already get their own dedicated Commission
// numbers elsewhere in this module, so folding them into Vendor Analysis
// too would double-count the same balance under two report tabs.
const getVendorAnalysis = async (req, res) => {
    try {
        const { projectId } = req.query;
        const vendors = await FinanceVendor.find({ vendorType: 'material_supplier', deleted: { $ne: true } });

        const rows = await Promise.all(vendors.map(async (v) => {
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

        res.json({ success: true, data: rows.sort((a, b) => b.amountOwed - a.amountOwed) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing vendor analysis' });
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

const getCashFlow = async (req, res) => {
    try {
        const { from, to, groupBy = 'day' } = req.query;

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

        res.json({
            success: true,
            data: {
                totals: { in: totalIn, out: totalOut, net: totalIn - totalOut },
                byCategory: [
                    { category: 'receipt', direction: 'in', amount: totalIn },
                    ...Object.entries(outByCategory).map(([category, amount]) => ({ category, direction: 'out', amount })),
                ],
                series: seriesArr,
            },
        });
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
    getProjectProfit, getClientProfit, getWorkProfit,
    getContractorAnalysis, getVendorAnalysis, getMaterialAnalysis,
    getCashFlow, getExpenseAnalysis,
    getCaMonthlyPackage, downloadCaMonthlyPackage,
};
