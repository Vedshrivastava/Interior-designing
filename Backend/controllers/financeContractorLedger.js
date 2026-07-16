import FinanceWork from '../models/financeWork.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceContractorRate from '../models/financeContractorRate.js';
import FinanceWorkContractorAssignment from '../models/financeWorkContractorAssignment.js';
import FinanceProject from '../models/financeProject.js';
import FinanceContractorAdvance from '../models/financeContractorAdvance.js';
import FinanceContractorDeduction from '../models/financeContractorDeduction.js';
import FinanceContractorPayment from '../models/financeContractorPayment.js';
import { assertContractorVendor } from '../utils/contractorVendor.js';

// totalArea − approvedArea on floats accumulated across many measurements
// produces artifacts like 21.300000000000001 — round for display/storage.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/*
 * Everything here is computed fresh on every call — nothing is stored.
 * Same anti-drift rule already used for current-stock, Receivables, and
 * Payables elsewhere in this codebase.
 *
 * Earnings only count engineer-approved area — unapproved ("neglected")
 * measured area is tracked separately (per-row neglectedAreaSqft/totals.
 * neglectedAmount) but excluded from what's actually owed, the same gate
 * financeRunningBill already applies for client billing. This means
 * Balance Payable can go negative: if a contractor's already been paid
 * more than their currently-approved work earns, that's "Extra Paid"
 * (an advance against work not yet approved), not a balance due — the
 * frontend is responsible for that framing, this endpoint just reports
 * the signed number.
 *
 * Balance Payable = Earnings − Advances − Deductions − Payments.
 *
 * INTERPRETATION FLAG: the source structure doc gives this as shorthand
 * ("Advance − Expense Given − Deductions = Balance Payable"). This is the
 * one place that formula lives — everything else (Payables' Contractor
 * tab, the Contractors page Ledger/Settlements tabs) just reads this
 * endpoint, so adjust only here if that interpretation turns out wrong.
 */
const getContractorLedger = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { projectId } = req.query;

        const vendor = await assertContractorVendor(vendorId);

        const assignments = await FinanceWorkContractorAssignment.find({ contractorVendorId: vendorId, deleted: { $ne: true } });
        const workIds = assignments.map(a => a.workId);

        const workFilter = { _id: { $in: workIds }, deleted: { $ne: true } };
        if (projectId) workFilter.projectId = projectId;
        const works = await FinanceWork.find(workFilter).sort({ createdAt: -1 });
        const workById = new Map(works.map(w => [w._id.toString(), w]));

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
        const areaByWork = new Map(); // workId -> { totalArea, approvedArea }
        for (const w of works) areaByWork.set(w._id.toString(), { totalArea: 0, approvedArea: 0 });

        const measurements = works.length
            ? await FinanceMeasurement.find({ workId: { $in: works.map(w => w._id) }, contractorVendorId: vendorId, deleted: { $ne: true } })
                .populate('workId', 'workType')
                .sort({ date: -1 })
            : [];
        for (const m of measurements) {
            const workKey = m.workId._id.toString();
            const cur = areaByWork.get(workKey) || { totalArea: 0, approvedArea: 0 };
            cur.totalArea += m.areaCoveredSqft;
            if (m.engineerApproved) cur.approvedArea += m.areaCoveredSqft;
            areaByWork.set(workKey, cur);
        }

        let earningsTotal = 0;
        let neglectedAmountTotal = 0;
        const worksOut = [];
        for (const w of works) {
            const { totalArea, approvedArea } = areaByWork.get(w._id.toString());
            const rate = rateByKey.get(`${w.projectId}_${w.workType}`);
            const rateValue = rate ? (rate.paymentBasis === 'per_day' ? rate.ratePerDay : rate.ratePerSqft) : 0;
            const neglectedArea = round2(totalArea - approvedArea);
            const earnings = round2(rate ? approvedArea * rateValue : 0);
            const neglectedAmount = round2(rate ? neglectedArea * rateValue : 0);
            earningsTotal += earnings;
            neglectedAmountTotal += neglectedAmount;
            worksOut.push({
                _id: w._id,
                projectId: w.projectId, projectName: projectNameById.get(w.projectId.toString()) || '—',
                workType: w.workType,
                estimatedAreaSqft: w.estimatedAreaSqft, completedAreaSqft: round2(totalArea),
                approvedAreaSqft: round2(approvedArea), neglectedAreaSqft: neglectedArea,
                status: w.status,
                rate: rate ? { paymentBasis: rate.paymentBasis, ratePerSqft: rate.ratePerSqft, ratePerDay: rate.ratePerDay } : null,
                earnings, neglectedAmount,
            });
        }

        const moneyFilter = { vendorId, deleted: { $ne: true } };
        if (projectId) moneyFilter.projectId = projectId;
        const [advances, deductions, payments] = await Promise.all([
            FinanceContractorAdvance.find(moneyFilter).sort({ date: -1 }),
            FinanceContractorDeduction.find(moneyFilter).sort({ date: -1 }),
            FinanceContractorPayment.find(moneyFilter).populate('bankAccountId', 'accountName').sort({ date: -1 }),
        ]);

        const advancesTotal = advances.reduce((sum, a) => sum + a.amount, 0);
        const deductionsTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
        const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
        earningsTotal = round2(earningsTotal);
        neglectedAmountTotal = round2(neglectedAmountTotal);
        const balancePayable = round2(earningsTotal - advancesTotal - deductionsTotal - paymentsTotal);

        res.json({
            success: true,
            data: {
                vendorId: vendor._id, vendorName: vendor.name,
                works: worksOut, measurements, advances, deductions, payments,
                totals: {
                    earnings: earningsTotal, neglectedAmount: neglectedAmountTotal,
                    advances: advancesTotal, deductions: deductionsTotal, payments: paymentsTotal, balancePayable,
                },
            },
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error computing contractor ledger' });
    }
};

export { getContractorLedger };
