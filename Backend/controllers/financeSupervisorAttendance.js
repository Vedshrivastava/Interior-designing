import FinanceSupervisorAttendance from '../models/financeSupervisorAttendance.js';
import { broadcast } from '../middlewares/webSocket.js';

const listSupervisorAttendance = async (req, res) => {
    try {
        const { employeeId, dateFrom, dateTo } = req.query;
        if (!employeeId) return res.status(400).json({ success: false, message: 'employeeId is required' });
        const filter = { employeeId, deleted: { $ne: true } };
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) filter.date.$lte = new Date(dateTo);
        }
        const items = await FinanceSupervisorAttendance.find(filter).sort({ date: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching supervisor attendance' });
    }
};

const addSupervisorAttendance = async (req, res) => {
    try {
        const { employeeId, date, status, notes } = req.body;
        if (!employeeId) return res.status(400).json({ success: false, message: 'Employee is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
        if (!['present', 'absent', 'half_day', 'leave'].includes(status)) {
            return res.status(400).json({ success: false, message: 'status must be present, absent, half_day, or leave' });
        }
        const item = new FinanceSupervisorAttendance({ employeeId, date, status, notes: notes || '' });
        await item.save();
        broadcast({ type: 'financeSupervisorAttendanceChanged', employeeId });
        res.json({ success: true, message: 'Attendance recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording attendance' });
    }
};

const removeSupervisorAttendance = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceSupervisorAttendance.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeSupervisorAttendanceChanged', employeeId: item.employeeId });
        res.json({ success: true, message: 'Attendance entry removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing attendance entry' });
    }
};

export { listSupervisorAttendance, addSupervisorAttendance, removeSupervisorAttendance };
