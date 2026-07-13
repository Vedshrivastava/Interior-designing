import FinanceCommissionPayment from '../models/financeCommissionPayment.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { assertReferralVendor } from '../utils/contractorVendor.js';
import { broadcast } from '../middlewares/webSocket.js';

const listCommissionPayments = async (req, res) => {
    try {
        const { vendorId, projectId } = req.query;
        if (!vendorId && !projectId) return res.status(400).json({ success: false, message: 'vendorId or projectId is required' });
        const filter = { deleted: { $ne: true } };
        if (vendorId) filter.vendorId = vendorId;
        if (projectId) filter.projectId = projectId;
        const items = await FinanceCommissionPayment.find(filter).populate('bankAccountId', 'accountName').populate('tdsSectionId', 'name code').sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching commission payments' });
    }
};

// bankAccountId means bank (the bank statement reads it directly); no
// bankAccountId means cash — a financeCashEntry is auto-created below.
const addCommissionPayment = async (req, res) => {
    try {
        const { vendorId, projectId, amount, date, paymentMode, bankOrCashLabel, bankAccountId, utrNumber, notes, tdsSectionId, tdsAmount } = req.body;
        if (!vendorId) return res.status(400).json({ success: false, message: 'Vendor is required' });
        await assertReferralVendor(vendorId);
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceCommissionPayment({
            vendorId, projectId: projectId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null, utrNumber: utrNumber || '',
            notes: notes || '',
            tdsSectionId: tdsSectionId || null, tdsAmount: (tdsAmount !== undefined && tdsAmount !== '') ? Number(tdsAmount) : null,
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount), projectId: projectId || null,
                reason: 'Commission payment', relatedCommissionPaymentId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        }

        broadcast({ type: 'financeCommissionPaymentsChanged', vendorId });
        res.json({ success: true, message: 'Commission payment recorded', data: item });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error recording commission payment' });
    }
};

const updateCommissionPayment = async (req, res) => {
    try {
        const { _id, projectId, amount, date, paymentMode, bankOrCashLabel, utrNumber, notes, tdsSectionId, tdsAmount } = req.body;
        const existing = await FinanceCommissionPayment.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        await FinanceCommissionPayment.findByIdAndUpdate(_id, {
            projectId: projectId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', utrNumber: utrNumber || '', notes: notes || '',
            tdsSectionId: tdsSectionId || null, tdsAmount: (tdsAmount !== undefined && tdsAmount !== '') ? Number(tdsAmount) : null,
        });
        broadcast({ type: 'financeCommissionPaymentsChanged', vendorId: existing.vendorId });
        res.json({ success: true, message: 'Commission payment updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating commission payment' });
    }
};

const removeCommissionPayment = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceCommissionPayment.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceCashEntry.updateMany(
            { relatedCommissionPaymentId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeCommissionPaymentsChanged', vendorId: item.vendorId });
        broadcast({ type: 'financeCashBookChanged' });
        res.json({ success: true, message: 'Commission payment removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing commission payment' });
    }
};

export { listCommissionPayments, addCommissionPayment, updateCommissionPayment, removeCommissionPayment };
