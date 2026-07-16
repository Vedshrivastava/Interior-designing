import FinanceLabourPayment from '../models/financeLabourPayment.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listLabourPayments = async (req, res) => {
    try {
        const { labourerId, projectId } = req.query;
        if (!labourerId && !projectId) return res.status(400).json({ success: false, message: 'labourerId or projectId is required' });
        const filter = { deleted: { $ne: true } };
        if (labourerId) filter.labourerId = labourerId;
        if (projectId) filter.projectId = projectId;
        const items = await FinanceLabourPayment.find(filter).populate('bankAccountId', 'accountName').sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching payments' });
    }
};

// bankAccountId means bank; no bankAccountId means cash — a
// financeCashEntry is auto-created below, same pattern as every other
// payment controller in this codebase.
const addLabourPayment = async (req, res) => {
    try {
        const { labourerId, projectId, amount, date, paymentMode, bankOrCashLabel, bankAccountId, notes } = req.body;
        if (!labourerId) return res.status(400).json({ success: false, message: 'Labourer is required' });
        const labourer = await FinanceLabourer.findOne({ _id: labourerId, deleted: { $ne: true } });
        if (!labourer) return res.status(404).json({ success: false, message: 'Labourer not found' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceLabourPayment({
            labourerId, projectId: projectId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null,
            notes: notes || '',
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount), projectId: projectId || null,
                reason: 'Labour payment', relatedLabourPaymentId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        }

        broadcast({ type: 'financeLabourLedgerChanged', labourerId });

        await logActivity({
            eventType: 'labour_paid',
            entityType: 'financeLabourPayment',
            entityId: item._id,
            projectId: projectId || null,
            summary: `${labourer.name} paid ₹${Number(amount)}`,
            amount: Number(amount),
            req,
        });

        res.json({ success: true, message: 'Payment recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording payment' });
    }
};

const removeLabourPayment = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceLabourPayment.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceCashEntry.updateMany(
            { relatedLabourPaymentId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeLabourLedgerChanged', labourerId: item.labourerId });
        broadcast({ type: 'financeCashBookChanged' });
        res.json({ success: true, message: 'Payment removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing payment' });
    }
};

export { listLabourPayments, addLabourPayment, removeLabourPayment };
