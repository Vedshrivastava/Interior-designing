import FinanceLabourAdvance from '../models/financeLabourAdvance.js';
import FinanceLabourer from '../models/financeLabourer.js';
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

const addLabourAdvance = async (req, res) => {
    try {
        const { labourerId, projectId, amount, date, paymentMode, bankOrCashLabel, notes } = req.body;
        if (!labourerId) return res.status(400).json({ success: false, message: 'Labourer is required' });
        const labourer = await FinanceLabourer.findOne({ _id: labourerId, deleted: { $ne: true } });
        if (!labourer) return res.status(404).json({ success: false, message: 'Labourer not found' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceLabourAdvance({
            labourerId, projectId: projectId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', notes: notes || '',
        });
        await item.save();
        broadcast({ type: 'financeLabourLedgerChanged', labourerId });

        await logActivity({
            eventType: 'labour_advance_given',
            entityType: 'financeLabourAdvance',
            entityId: item._id,
            projectId: projectId || null,
            summary: `₹${Number(amount)} advanced to ${labourer.name}`,
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
        broadcast({ type: 'financeLabourLedgerChanged', labourerId: item.labourerId });
        res.json({ success: true, message: 'Advance removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing advance' });
    }
};

export { listLabourAdvances, addLabourAdvance, removeLabourAdvance };
