import FinanceProject from '../models/financeProject.js';
import FinanceWork from '../models/financeWork.js';
import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import FinanceCommissionPayment from '../models/financeCommissionPayment.js';
import { assertReferralVendor } from '../utils/contractorVendor.js';

/*
 * Computed fresh on every call — nothing stored, same shape as the
 * Contractor/Vendor ledgers.
 *
 * Commission Earned = SUM over financeWork (for projects where
 * referralVendorId = this vendor) of completedAreaSqft × referralRatePerSqft
 * (looked up from financeWorkTypeRate for that project + workType).
 * Commission Payable = Commission Earned − SUM(commissionPayment.amount).
 */
const getCommissionLedger = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { projectId } = req.query;

        const vendor = await assertReferralVendor(vendorId);

        const projectFilter = { referralVendorId: vendorId, deleted: { $ne: true } };
        if (projectId) projectFilter._id = projectId;
        const projects = await FinanceProject.find(projectFilter);
        const projectIds = projects.map(p => p._id);
        const projectNameById = new Map(projects.map(p => [p._id.toString(), p.name]));

        const works = projectIds.length
            ? await FinanceWork.find({ projectId: { $in: projectIds }, deleted: { $ne: true } })
            : [];

        const rates = projectIds.length
            ? await FinanceWorkTypeRate.find({ projectId: { $in: projectIds }, deleted: { $ne: true } })
            : [];
        const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r]));

        let earningsTotal = 0;
        const worksOut = works.map(w => {
            const rate = rateByKey.get(`${w.projectId}_${w.workType}`);
            const earnings = rate ? w.completedAreaSqft * rate.referralRatePerSqft : 0;
            earningsTotal += earnings;
            return {
                _id: w._id, projectId: w.projectId, projectName: projectNameById.get(w.projectId.toString()) || '—',
                workType: w.workType, completedAreaSqft: w.completedAreaSqft,
                referralRatePerSqft: rate ? rate.referralRatePerSqft : null, earnings,
            };
        });

        const paymentFilter = { vendorId, deleted: { $ne: true } };
        if (projectId) paymentFilter.projectId = projectId;
        const payments = await FinanceCommissionPayment.find(paymentFilter).populate('bankAccountId', 'accountName').sort({ date: -1 });
        const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);

        const commissionPayable = earningsTotal - paymentsTotal;

        res.json({
            success: true,
            data: {
                vendorId: vendor._id, vendorName: vendor.name,
                works: worksOut, payments,
                totals: { earnings: earningsTotal, payments: paymentsTotal, commissionPayable },
            },
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error computing commission ledger' });
    }
};

export { getCommissionLedger };
