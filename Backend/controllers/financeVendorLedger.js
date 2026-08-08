import FinanceVendor from '../models/financeVendor.js';
import FinancePurchase from '../models/financePurchase.js';
import FinanceVendorPayment from '../models/financeVendorPayment.js';
import { computeVendorBalance } from './financeReports.js';

/*
 * Computed fresh on every call — nothing stored. Same anti-drift rule
 * used for the Contractor Ledger, current-stock, Receivables, and
 * Payables elsewhere in this codebase.
 *
 * Amount Owed comes from computeVendorBalance (financeReports.js) — see
 * that function's own comment. It used to be re-derived inline right here,
 * simply filtering purchases/payments directly by projectId when scoped;
 * that silently dropped every general/untagged vendor payment once
 * project-scoped (financeVendorPayment.projectId is optional), making a
 * vendor read as still owed their full purchase total right after being
 * paid. Not reachable today (nothing renders this ledger with a
 * projectId), but wrong the moment it is — fixed by standardizing on the
 * same proportional-allocation formula computeVendorAnalysisRows already
 * used correctly.
 *
 * Project Cost / Profitability roll-up from these purchases belongs to
 * the Reports/Profitability module later — this endpoint only exposes the
 * raw purchase/return/payment data plus the balance, nothing more.
 */
const getVendorLedger = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { projectId } = req.query;

        const vendor = await FinanceVendor.findById(vendorId);
        if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

        const purchaseFilter = { vendorId, deleted: { $ne: true } };
        if (projectId) purchaseFilter.projectId = projectId;
        const [purchases, payments, totals] = await Promise.all([
            FinancePurchase.find(purchaseFilter)
                .populate('materialId', 'name unit')
                .populate('projectId', 'name')
                .sort({ date: -1 }),
            // Raw rows for display — when scoped, includes general/untagged
            // payments too (not just ones tagged to exactly this project),
            // since computeVendorBalance below counts a proportional share
            // of those toward this project's own Amount Owed; a payment
            // tagged to a DIFFERENT specific project is still excluded, so
            // this never shows a payment that has nothing to do with the
            // project being viewed.
            FinanceVendorPayment.find({
                vendorId, deleted: { $ne: true },
                ...(projectId ? { $or: [{ projectId }, { projectId: null }] } : {}),
            }).populate('bankAccountId', 'accountName').sort({ date: -1 }),
            computeVendorBalance(vendorId, projectId),
        ]);

        res.json({
            success: true,
            data: {
                vendorId: vendor._id, vendorName: vendor.name,
                purchases: purchases.filter(p => p.transactionType === 'purchase'),
                returns: purchases.filter(p => p.transactionType === 'return'),
                payments,
                totals,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing vendor ledger' });
    }
};

export { getVendorLedger };
