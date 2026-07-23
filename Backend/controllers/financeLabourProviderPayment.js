import FinanceLabourProviderPayment from '../models/financeLabourProviderPayment.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { assertLabourProviderVendor } from '../utils/contractorVendor.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listLabourProviderPayments = async (req, res) => {
    try {
        const { labourProviderId, projectId } = req.query;
        if (!labourProviderId && !projectId) return res.status(400).json({ success: false, message: 'labourProviderId or projectId is required' });
        const filter = { deleted: { $ne: true } };
        if (labourProviderId) filter.labourProviderId = labourProviderId;
        if (projectId) filter.projectId = projectId;
        const items = await FinanceLabourProviderPayment.find(filter).populate('bankAccountId', 'accountName').populate('tdsSectionId', 'name code').sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching labour provider payments' });
    }
};

// bankAccountId means bank (the bank statement reads it directly); no
// bankAccountId means cash — a financeCashEntry is auto-created below.
const addLabourProviderPayment = async (req, res) => {
    try {
        const { labourProviderId, projectId, amount, date, paymentMode, bankOrCashLabel, bankAccountId, utrNumber, notes, tdsSectionId, tdsAmount } = req.body;
        if (!labourProviderId) return res.status(400).json({ success: false, message: 'Labour provider is required' });
        const provider = await assertLabourProviderVendor(labourProviderId);
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceLabourProviderPayment({
            labourProviderId, projectId: projectId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null, utrNumber: utrNumber || '',
            notes: notes || '',
            tdsSectionId: tdsSectionId || null, tdsAmount: (tdsAmount !== undefined && tdsAmount !== '') ? Number(tdsAmount) : null,
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount), projectId: projectId || null,
                reason: 'Labour provider payment', relatedLabourProviderPaymentId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        } else {
            broadcast({ type: 'financeBankAccountsChanged' });
        }

        broadcast({ type: 'financeLabourProviderPaymentsChanged', labourProviderId });

        await logActivity({
            eventType: 'labour_provider_paid',
            entityType: 'financeLabourProviderPayment',
            entityId: item._id,
            projectId: projectId || null,
            summary: `Labour provider payment of ₹${Number(amount)} paid to ${provider.name}`,
            amount: Number(amount),
            req,
        });

        res.json({ success: true, message: 'Labour provider payment recorded', data: item });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error recording labour provider payment' });
    }
};

const updateLabourProviderPayment = async (req, res) => {
    try {
        const { _id, projectId, amount, date, paymentMode, bankOrCashLabel, utrNumber, notes, tdsSectionId, tdsAmount } = req.body;
        const existing = await FinanceLabourProviderPayment.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        await FinanceLabourProviderPayment.findByIdAndUpdate(_id, {
            projectId: projectId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', utrNumber: utrNumber || '', notes: notes || '',
            tdsSectionId: tdsSectionId || null, tdsAmount: (tdsAmount !== undefined && tdsAmount !== '') ? Number(tdsAmount) : null,
        });
        broadcast({ type: 'financeLabourProviderPaymentsChanged', labourProviderId: existing.labourProviderId });
        if (existing.bankAccountId) broadcast({ type: 'financeBankAccountsChanged' });
        res.json({ success: true, message: 'Labour provider payment updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating labour provider payment' });
    }
};

const removeLabourProviderPayment = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceLabourProviderPayment.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceCashEntry.updateMany(
            { relatedLabourProviderPaymentId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeLabourProviderPaymentsChanged', labourProviderId: item.labourProviderId });
        broadcast({ type: 'financeCashBookChanged' });
        if (item.bankAccountId) broadcast({ type: 'financeBankAccountsChanged' });
        res.json({ success: true, message: 'Labour provider payment removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing labour provider payment' });
    }
};

export { listLabourProviderPayments, addLabourProviderPayment, updateLabourProviderPayment, removeLabourProviderPayment };
