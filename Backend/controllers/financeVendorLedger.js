import FinanceVendor from '../models/financeVendor.js';
import FinancePurchase from '../models/financePurchase.js';
import FinanceVendorPayment from '../models/financeVendorPayment.js';

/*
 * Computed fresh on every call — nothing stored. Same anti-drift rule
 * used for the Contractor Ledger, current-stock, Receivables, and
 * Payables elsewhere in this codebase.
 *
 * Amount Owed = SUM(purchase) − SUM(return) − SUM(vendorPayment).
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
        const purchases = await FinancePurchase.find(purchaseFilter)
            .populate('materialId', 'name unit')
            .populate('projectId', 'name')
            .sort({ date: -1 });

        const paymentFilter = { vendorId, deleted: { $ne: true } };
        if (projectId) paymentFilter.projectId = projectId;
        const payments = await FinanceVendorPayment.find(paymentFilter).populate('bankAccountId', 'accountName').sort({ date: -1 });

        const purchaseTotal = purchases.filter(p => p.transactionType === 'purchase').reduce((sum, p) => sum + p.totalAmount, 0);
        const returnTotal = purchases.filter(p => p.transactionType === 'return').reduce((sum, p) => sum + p.totalAmount, 0);
        const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
        const amountOwed = purchaseTotal - returnTotal - paymentsTotal;

        res.json({
            success: true,
            data: {
                vendorId: vendor._id, vendorName: vendor.name,
                purchases: purchases.filter(p => p.transactionType === 'purchase'),
                returns: purchases.filter(p => p.transactionType === 'return'),
                payments,
                totals: { purchases: purchaseTotal, returns: returnTotal, payments: paymentsTotal, amountOwed },
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing vendor ledger' });
    }
};

export { getVendorLedger };
