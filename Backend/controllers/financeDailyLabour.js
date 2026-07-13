import FinanceDailyLabour from '../models/financeDailyLabour.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { broadcast } from '../middlewares/webSocket.js';

// half_day = 0.5×rate, full_day = 1×rate, extra_day = 1.5×rate — per the
// build spec. Adjust here only if the real convention turns out different;
// this is the one place the multiplier lives.
const MULTIPLIER = { half_day: 0.5, full_day: 1, extra_day: 1.5 };

const listDailyLabour = async (req, res) => {
    try {
        const { projectId, supervisorId, dateFrom, dateTo } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        if (supervisorId) filter.supervisorId = supervisorId;
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) filter.date.$lte = new Date(dateTo);
        }
        const items = await FinanceDailyLabour.find(filter)
            .populate('projectId', 'name')
            .populate('supervisorId', 'name')
            .populate('bankAccountId', 'accountName')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching daily labour' });
    }
};

// amount is computed and frozen here — never accepted from the request
// body directly, same "server owns the money math" rule as Running Bill
// line items and Purchase totalAmount.
const addDailyLabour = async (req, res) => {
    try {
        const { projectId, date, labourerName, attendanceType, rate, supervisorId, paymentMode, bankOrCashLabel, bankAccountId, notes } = req.body;
        if (!projectId) return res.status(400).json({ success: false, message: 'Project is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
        if (!labourerName || !labourerName.trim()) return res.status(400).json({ success: false, message: 'Labourer name is required' });
        if (!MULTIPLIER[attendanceType]) return res.status(400).json({ success: false, message: 'attendanceType must be half_day, full_day, or extra_day' });
        if (!rate || Number(rate) <= 0) return res.status(400).json({ success: false, message: 'Rate must be greater than zero' });

        const amount = Number(rate) * MULTIPLIER[attendanceType];
        const item = new FinanceDailyLabour({
            projectId, date, labourerName: labourerName.trim(), attendanceType, rate: Number(rate), amount,
            supervisorId: supervisorId || null,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null,
            notes: notes || '',
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount, projectId,
                reason: `Daily labour — ${labourerName.trim()}`, relatedDailyLabourId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        }

        broadcast({ type: 'financeDailyLabourChanged', projectId });
        res.json({ success: true, message: 'Daily labour recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording daily labour' });
    }
};

const removeDailyLabour = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceDailyLabour.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceCashEntry.updateMany(
            { relatedDailyLabourId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeDailyLabourChanged', projectId: item.projectId });
        broadcast({ type: 'financeCashBookChanged' });
        res.json({ success: true, message: 'Daily labour entry removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing daily labour entry' });
    }
};

export { listDailyLabour, addDailyLabour, removeDailyLabour };
