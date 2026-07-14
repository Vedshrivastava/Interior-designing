import FinanceLabourer from '../models/financeLabourer.js';
import FinanceDailyLabour from '../models/financeDailyLabour.js';
import { broadcast } from '../middlewares/webSocket.js';

const listLabourers = async (req, res) => {
    try {
        const { supervisorId } = req.query;
        const filter = { deleted: { $ne: true } };
        if (supervisorId) filter.supervisorId = supervisorId;
        const items = await FinanceLabourer.find(filter).sort({ name: 1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching labourers' });
    }
};

const addLabourer = async (req, res) => {
    try {
        const { name, supervisorId, defaultRate, notes } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!supervisorId) return res.status(400).json({ success: false, message: 'Supervisor is required' });
        const item = new FinanceLabourer({
            name: name.trim(), supervisorId, defaultRate: Number(defaultRate) || 0, notes: notes || '',
        });
        await item.save();
        broadcast({ type: 'financeLabourersChanged', supervisorId });
        res.json({ success: true, message: 'Labourer added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding labourer' });
    }
};

const updateLabourer = async (req, res) => {
    try {
        const { _id, name, defaultRate, notes } = req.body;
        const existing = await FinanceLabourer.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Labourer not found' });
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
        await FinanceLabourer.findByIdAndUpdate(_id, {
            name: name.trim(), defaultRate: Number(defaultRate) || 0, notes: notes || '',
        });
        broadcast({ type: 'financeLabourersChanged', supervisorId: existing.supervisorId });
        res.json({ success: true, message: 'Labourer updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating labourer' });
    }
};

const removeLabourer = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceLabourer.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Labourer not found' });
        const entryCount = await FinanceDailyLabour.countDocuments({ labourerId: _id, deleted: { $ne: true } });
        if (entryCount > 0) {
            return res.status(400).json({ success: false, message: 'This labourer has daily labour entries recorded against them — remove those first' });
        }
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeLabourersChanged', supervisorId: item.supervisorId });
        res.json({ success: true, message: 'Labourer removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing labourer' });
    }
};

export { listLabourers, addLabourer, updateLabourer, removeLabourer };
