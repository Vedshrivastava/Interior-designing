import FinanceMaterial from '../models/financeMaterial.js';
import { broadcast } from '../middlewares/webSocket.js';

const listFinanceMaterials = async (req, res) => {
    try {
        const items = await FinanceMaterial.find({ deleted: { $ne: true } }).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching materials' });
    }
};

const addFinanceMaterial = async (req, res) => {
    try {
        const { name, unit, minimumStockLevel, notes, workTypes } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const existing = await FinanceMaterial.findOne({ name: name.trim() });
        if (existing) return res.status(400).json({ success: false, message: 'Material already exists' });
        const item = new FinanceMaterial({
            name: name.trim(), unit, minimumStockLevel, notes,
            workTypes: (workTypes || []).map(w => w.trim()).filter(Boolean),
        });
        await item.save();
        broadcast({ type: 'financeMaterialsChanged' });
        res.json({ success: true, message: 'Material added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding material' });
    }
};

const updateFinanceMaterial = async (req, res) => {
    try {
        const { _id, name, unit, minimumStockLevel, notes, workTypes } = req.body;
        const existing = await FinanceMaterial.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Material not found' });
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        await FinanceMaterial.findByIdAndUpdate(_id, {
            name: name.trim(), unit, minimumStockLevel, notes,
            workTypes: (workTypes || []).map(w => w.trim()).filter(Boolean),
        });
        broadcast({ type: 'financeMaterialsChanged' });
        res.json({ success: true, message: 'Material updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating material' });
    }
};

const removeFinanceMaterial = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceMaterial.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeMaterialsChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing material' });
    }
};

export { listFinanceMaterials, addFinanceMaterial, updateFinanceMaterial, removeFinanceMaterial };
