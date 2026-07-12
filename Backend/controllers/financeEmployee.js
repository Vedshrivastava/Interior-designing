import FinanceEmployee from '../models/financeEmployee.js';
import { broadcast } from '../middlewares/webSocket.js';

const listFinanceEmployees = async (req, res) => {
    try {
        const items = await FinanceEmployee.find({ deleted: { $ne: true } }).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching employees' });
    }
};

const addFinanceEmployee = async (req, res) => {
    try {
        const { name, designation, phone, email, salary, joiningDate, notes } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const item = new FinanceEmployee({
            name: name.trim(), designation, phone, email, salary, joiningDate, notes,
        });
        await item.save();
        broadcast({ type: 'financeEmployeesChanged' });
        res.json({ success: true, message: 'Employee added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding employee' });
    }
};

const updateFinanceEmployee = async (req, res) => {
    try {
        const { _id, name, designation, phone, email, salary, joiningDate, notes } = req.body;
        const existing = await FinanceEmployee.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Employee not found' });
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        await FinanceEmployee.findByIdAndUpdate(_id, { name: name.trim(), designation, phone, email, salary, joiningDate, notes });
        broadcast({ type: 'financeEmployeesChanged' });
        res.json({ success: true, message: 'Employee updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating employee' });
    }
};

const removeFinanceEmployee = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceEmployee.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeEmployeesChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing employee' });
    }
};

export { listFinanceEmployees, addFinanceEmployee, updateFinanceEmployee, removeFinanceEmployee };
