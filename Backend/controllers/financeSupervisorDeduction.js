import FinanceSupervisorDeduction from '../models/financeSupervisorDeduction.js';
import FinanceEmployee from '../models/financeEmployee.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listSupervisorDeductions = async (req, res) => {
    try {
        const { employeeId, projectId } = req.query;
        if (!employeeId && !projectId) return res.status(400).json({ success: false, message: 'employeeId or projectId is required' });
        const filter = { deleted: { $ne: true } };
        if (employeeId) filter.employeeId = employeeId;
        if (projectId) filter.projectId = projectId;
        const items = await FinanceSupervisorDeduction.find(filter)
            .populate('projectId', 'name')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching supervisor deductions' });
    }
};

const addSupervisorDeduction = async (req, res) => {
    try {
        const { employeeId, projectId, amount, reason, date, notes } = req.body;
        if (!employeeId) return res.status(400).json({ success: false, message: 'Employee is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!reason || !reason.trim()) return res.status(400).json({ success: false, message: 'Reason is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceSupervisorDeduction({
            employeeId, projectId: projectId || null, amount: Number(amount), reason: reason.trim(), date, notes: notes || '',
        });
        await item.save();
        broadcast({ type: 'financeSupervisorDeductionsChanged', employeeId });

        const employee = await FinanceEmployee.findById(employeeId).select('name');
        await logActivity({
            eventType: 'supervisor_deduction_applied',
            entityType: 'financeSupervisorDeduction',
            entityId: item._id,
            projectId: projectId || null,
            summary: `₹${Number(amount)} deducted from ${employee?.name || 'employee'} — ${reason.trim()}`,
            amount: Number(amount),
            req,
        });

        res.json({ success: true, message: 'Deduction recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording deduction' });
    }
};

const removeSupervisorDeduction = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceSupervisorDeduction.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeSupervisorDeductionsChanged', employeeId: item.employeeId });
        res.json({ success: true, message: 'Deduction removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing deduction' });
    }
};

export { listSupervisorDeductions, addSupervisorDeduction, removeSupervisorDeduction };
