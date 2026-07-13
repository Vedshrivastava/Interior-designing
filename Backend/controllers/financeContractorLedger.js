import FinanceTeam from '../models/financeTeam.js';
import FinanceWork from '../models/financeWork.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceTeamRate from '../models/financeTeamRate.js';
import FinanceProject from '../models/financeProject.js';
import FinanceContractorAdvance from '../models/financeContractorAdvance.js';
import FinanceContractorDeduction from '../models/financeContractorDeduction.js';
import FinanceContractorPayment from '../models/financeContractorPayment.js';
import { assertContractorVendor } from '../utils/contractorVendor.js';

/*
 * Everything here is computed fresh on every call — nothing is stored.
 * Same anti-drift rule already used for current-stock, Receivables, and
 * Payables elsewhere in this codebase.
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

        const teams = await FinanceTeam.find({ contractorVendorId: vendorId, deleted: { $ne: true } });
        const teamIds = teams.map(t => t._id);
        const teamNameById = new Map(teams.map(t => [t._id.toString(), t.name]));

        const workFilter = { teamId: { $in: teamIds }, deleted: { $ne: true } };
        if (projectId) workFilter.projectId = projectId;
        const works = await FinanceWork.find(workFilter).sort({ createdAt: -1 });

        const projectIds = [...new Set(works.map(w => w.projectId.toString()))];
        const projects = await FinanceProject.find({ _id: { $in: projectIds } });
        const projectNameById = new Map(projects.map(p => [p._id.toString(), p.name]));

        const rates = await FinanceTeamRate.find({
            projectId: { $in: projectIds }, teamId: { $in: teamIds }, deleted: { $ne: true },
        });
        const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.teamId}_${r.workType}`, r]));

        let earningsTotal = 0;
        const worksOut = works.map(w => {
            const rate = rateByKey.get(`${w.projectId}_${w.teamId}_${w.workType}`);
            const earnings = rate ? w.completedAreaSqft * (rate.paymentBasis === 'per_day' ? rate.ratePerDay : rate.ratePerSqft) : 0;
            earningsTotal += earnings;
            return {
                _id: w._id,
                projectId: w.projectId, projectName: projectNameById.get(w.projectId.toString()) || '—',
                teamId: w.teamId, teamName: teamNameById.get(w.teamId.toString()) || '—',
                workType: w.workType,
                estimatedAreaSqft: w.estimatedAreaSqft, completedAreaSqft: w.completedAreaSqft,
                status: w.status,
                rate: rate ? { paymentBasis: rate.paymentBasis, ratePerSqft: rate.ratePerSqft, ratePerDay: rate.ratePerDay } : null,
                earnings,
            };
        });

        const workIds = works.map(w => w._id);
        const measurements = workIds.length
            ? await FinanceMeasurement.find({ workId: { $in: workIds }, deleted: { $ne: true } })
                .populate('workId', 'workType')
                .sort({ date: -1 })
            : [];

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
        const balancePayable = earningsTotal - advancesTotal - deductionsTotal - paymentsTotal;

        res.json({
            success: true,
            data: {
                vendorId: vendor._id, vendorName: vendor.name,
                works: worksOut, measurements, advances, deductions, payments,
                totals: { earnings: earningsTotal, advances: advancesTotal, deductions: deductionsTotal, payments: paymentsTotal, balancePayable },
            },
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error computing contractor ledger' });
    }
};

export { getContractorLedger };
