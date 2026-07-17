import { v2 as cloudinary } from 'cloudinary';
import FinanceEmployee from '../models/financeEmployee.js';
import { broadcast } from '../middlewares/webSocket.js';
import { addDocumentToRecord, removeDocumentFromRecord } from '../utils/uploadDocuments.js';

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

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

const addEmployeeDocument = async (req, res) => {
    try {
        const { employeeId, note } = req.body;
        if (!employeeId) return res.status(400).json({ success: false, message: 'Employee is required' });
        if (!req.file) return res.status(400).json({ success: false, message: 'A file is required' });
        const item = await addDocumentToRecord(FinanceEmployee, employeeId, req.file, note, 'employee_documents');
        if (!item) return res.status(404).json({ success: false, message: 'Employee not found' });
        broadcast({ type: 'financeEmployeesChanged' });
        res.json({ success: true, message: 'Document added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding document' });
    }
};

const removeEmployeeDocument = async (req, res) => {
    try {
        const { employeeId, documentId } = req.body;
        const item = await removeDocumentFromRecord(FinanceEmployee, employeeId, documentId);
        if (!item) return res.status(404).json({ success: false, message: 'Employee not found' });
        broadcast({ type: 'financeEmployeesChanged' });
        res.json({ success: true, message: 'Document removed', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing document' });
    }
};

export { listFinanceEmployees, addFinanceEmployee, updateFinanceEmployee, removeFinanceEmployee, addEmployeeDocument, removeEmployeeDocument };
