import FinanceLabourAdvance from '../models/financeLabourAdvance.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listLabourAdvances = async (req, res) => {
    try {
        const { labourerId, projectId } = req.query;
        if (!labourerId && !projectId) return res.status(400).json({ success: false, message: 'labourerId or projectId is required' });
        const filter = { deleted: { $ne: true } };
        if (labourerId) filter.labourerId = labourerId;
        if (projectId) filter.projectId = projectId;
        const items = await FinanceLabourAdvance.find(filter).sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching advances' });
    }
};

// BUG FIX: an advance is real cash handed to the labourer right now
// (Balance Payable already treats it exactly like a Payment) — it used
// to never touch the Cash Book or a bank account, so it was invisible to
// Cash in Hand/Bank. Mirrors addLabourPayment's own cash-entry automation
// (minus TDS — advances aren't withheld against). See
// financeContractorAdvance.js's identical comment.
const addLabourAdvance = async (req, res) => {
    try {
        const { labourerId, projectId, amount, date, paymentMode, bankOrCashLabel, bankAccountId, notes } = req.body;
        if (!labourerId) return res.status(400).json({ success: false, message: 'Labourer is required' });
        const labourer = await FinanceLabourer.findOne({ _id: labourerId, deleted: { $ne: true } });
        if (!labourer) return res.status(404).json({ success: false, message: 'Labourer not found' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceLabourAdvance({
            labourerId, projectId: projectId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null, notes: notes || '',
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount), projectId: projectId || null,
                reason: 'Labour advance', relatedLabourAdvanceId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        } else {
            broadcast({ type: 'financeBankAccountsChanged' });
        }

        broadcast({ type: 'financeLabourLedgerChanged', labourerId });

        await logActivity({
            eventType: 'labour_advance_given',
            entityType: 'financeLabourAdvance',
            entityId: item._id,
            projectId: projectId || null,
            summary: `Advance given to ${labourer.name}`,
            entityNames: [labourer.name],
            amount: Number(amount),
            req,
        });

        res.json({ success: true, message: 'Advance recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording advance' });
    }
};

const removeLabourAdvance = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceLabourAdvance.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceCashEntry.updateMany(
            { relatedLabourAdvanceId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeLabourLedgerChanged', labourerId: item.labourerId });
        broadcast({ type: 'financeCashBookChanged' });
        if (item.bankAccountId) broadcast({ type: 'financeBankAccountsChanged' });
        res.json({ success: true, message: 'Advance removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing advance' });
    }
};

export { listLabourAdvances, addLabourAdvance, removeLabourAdvance };
