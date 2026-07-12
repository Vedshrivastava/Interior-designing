import FinanceVendor from '../models/financeVendor.js';
import { broadcast } from '../middlewares/webSocket.js';

const listFinanceVendors = async (req, res) => {
    try {
        const items = await FinanceVendor.find({ deleted: { $ne: true } }).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching vendors' });
    }
};

const addFinanceVendor = async (req, res) => {
    try {
        const { name, vendorType, phone, email, address, gstNumber, notes } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const item = new FinanceVendor({
            name: name.trim(), vendorType, phone, email, address, gstNumber, notes,
        });
        await item.save();
        broadcast({ type: 'financeVendorsChanged' });
        res.json({ success: true, message: 'Vendor added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding vendor' });
    }
};

const updateFinanceVendor = async (req, res) => {
    try {
        const { _id, name, vendorType, phone, email, address, gstNumber, notes } = req.body;
        const existing = await FinanceVendor.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Vendor not found' });
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        await FinanceVendor.findByIdAndUpdate(_id, { name: name.trim(), vendorType, phone, email, address, gstNumber, notes });
        broadcast({ type: 'financeVendorsChanged' });
        res.json({ success: true, message: 'Vendor updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating vendor' });
    }
};

const removeFinanceVendor = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceVendor.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeVendorsChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing vendor' });
    }
};

export { listFinanceVendors, addFinanceVendor, updateFinanceVendor, removeFinanceVendor };
