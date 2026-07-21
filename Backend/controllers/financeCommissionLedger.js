import FinanceProject from '../models/financeProject.js';
import FinanceWork from '../models/financeWork.js';
import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import FinanceCommissionPayment from '../models/financeCommissionPayment.js';
import { assertReferralVendor } from '../utils/contractorVendor.js';
import { getApprovedBillingByWorkId, splitApprovedAreaByShare } from './financeReports.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/*
 * Computed fresh on every call — nothing stored, same shape as the
 * Contractor/Labour ledgers, including the same Approved/Unapproved
 * split: a referral vendor's commission is only actually payable once
 * the work it's earned on has been reviewed (financeWorkReview), same
 * "one review gates both sides" rule that already governs client
 * billing and contractor/labour pay — this used to compute Commission
 * Payable straight off completedAreaSqft (everything ever logged,
 * reviewed or not), the only ledger in the app that wasn't gated by
 * review. A referral vendor is 1-per-project (not a per-work
 * assignment like a contractor), so no proportional split across
 * multiple claimants is needed — splitApprovedAreaByShare is still
 * reused (with partyArea === totalAreaAllParties) purely so the "never
 * exceed what's actually been reviewed" clamping logic isn't
 * reimplemented a second time.
 *
 * Commission Earned (Approved) = SUM over financeWork (for projects
 * where referralVendorId = this vendor) of approvedAreaSqft ×
 * referralRatePerSqft. Commission Payable = Approved Earned −
 * SUM(commissionPayment.amount).
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

        const [rates, approvedBillingByWorkId] = await Promise.all([
            projectIds.length
                ? FinanceWorkTypeRate.find({ projectId: { $in: projectIds }, deleted: { $ne: true } })
                : [],
            works.length ? getApprovedBillingByWorkId(works.map(w => w._id)) : new Map(),
        ]);
        const rateByKey = new Map(rates.map(r => [`${r.projectId}_${r.workType}`, r]));

        let earningsTotal = 0;
        let totalAmountTotal = 0;
        let unapprovedAmountTotal = 0;
        const worksOut = works.map(w => {
            const workKey = w._id.toString();
            const rate = rateByKey.get(`${w.projectId}_${w.workType}`);
            const rateValue = rate ? rate.referralRatePerSqft : 0;
            const workApproved = approvedBillingByWorkId.get(workKey) || { areaSqft: 0, date: null };
            const approvedArea = splitApprovedAreaByShare(workApproved.areaSqft, w.completedAreaSqft, w.completedAreaSqft);
            const unapprovedArea = round2(w.completedAreaSqft - approvedArea);
            const totalAmount = round2(rate ? w.completedAreaSqft * rateValue : 0);
            const earnings = round2(rate ? approvedArea * rateValue : 0);
            const unapprovedAmount = round2(rate ? unapprovedArea * rateValue : 0);
            earningsTotal += earnings;
            totalAmountTotal += totalAmount;
            unapprovedAmountTotal += unapprovedAmount;
            return {
                _id: w._id, projectId: w.projectId, projectName: projectNameById.get(w.projectId.toString()) || '—',
                workType: w.workType, completedAreaSqft: w.completedAreaSqft,
                referralRatePerSqft: rate ? rate.referralRatePerSqft : null,
                totalAmount, earnings, unapprovedAmount,
                approvedAreaSqft: approvedArea, unapprovedAreaSqft: unapprovedArea, approvedDate: approvedArea > 0 ? workApproved.date : null,
            };
        });

        const paymentFilter = { vendorId, deleted: { $ne: true } };
        if (projectId) paymentFilter.projectId = projectId;
        const payments = await FinanceCommissionPayment.find(paymentFilter).populate('bankAccountId', 'accountName').sort({ date: -1 });
        const paymentsTotal = round2(payments.reduce((sum, p) => sum + p.amount, 0));

        earningsTotal = round2(earningsTotal);
        const commissionPayable = round2(earningsTotal - paymentsTotal);

        res.json({
            success: true,
            data: {
                vendorId: vendor._id, vendorName: vendor.name,
                works: worksOut, payments,
                totals: {
                    totalAmount: round2(totalAmountTotal), earnings: earningsTotal, unapprovedAmount: round2(unapprovedAmountTotal),
                    payments: paymentsTotal, commissionPayable,
                },
            },
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error computing commission ledger' });
    }
};

export { getCommissionLedger };
