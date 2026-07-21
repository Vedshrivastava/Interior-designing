import FinanceCommissionPayment from '../models/financeCommissionPayment.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { assertReferralVendor } from '../utils/contractorVendor.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listCommissionPayments = async (req, res) => {
    try {
        const { referralId, projectId } = req.query;
        if (!referralId && !projectId) return res.status(400).json({ success: false, message: 'referralId or projectId is required' });
        const filter = { deleted: { $ne: true } };
        if (referralId) filter.referralId = referralId;
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
        const { referralId, projectId, amount, date, paymentMode, bankOrCashLabel, bankAccountId, utrNumber, notes, tdsSectionId, tdsAmount } = req.body;
        if (!referralId) return res.status(400).json({ success: false, message: 'Referral is required' });
        const referral = await assertReferralVendor(referralId);
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceCommissionPayment({
            referralId, projectId: projectId || null, amount: Number(amount), date,
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

        broadcast({ type: 'financeCommissionPaymentsChanged', referralId });

        await logActivity({
            eventType: 'commission_paid',
            entityType: 'financeCommissionPayment',
            entityId: item._id,
            projectId: projectId || null,
            summary: `Commission of ₹${Number(amount)} paid to ${referral.name}`,
            amount: Number(amount),
            req,
        });

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
        broadcast({ type: 'financeCommissionPaymentsChanged', referralId: existing.referralId });
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
        broadcast({ type: 'financeCommissionPaymentsChanged', referralId: item.referralId });
        broadcast({ type: 'financeCashBookChanged' });
        res.json({ success: true, message: 'Commission payment removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing commission payment' });
    }
};

export { listCommissionPayments, addCommissionPayment, updateCommissionPayment, removeCommissionPayment };
