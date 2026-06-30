import Material from '../models/material.js';
import { broadcast } from '../middlewares/webSocket.js';

const SEED = [
    { name: 'Concrete',        icon: 'mdi:texture',           color: '#64748b', order: 1  },
    { name: 'Teak Wood',       icon: 'mdi:tree',               color: '#a16207', order: 2  },
    { name: 'Mild Steel',      icon: 'mdi:anvil',              color: '#78716c', order: 3  },
    { name: 'Brass',           icon: 'mdi:circle',             color: '#d97706', order: 4  },
    { name: 'Glass',           icon: 'mdi:square-outline',     color: '#0ea5e9', order: 5  },
    { name: 'Marble',          icon: 'mdi:texture-box',        color: '#94a3b8', order: 6  },
    { name: 'Granite',         icon: 'mdi:dots-grid',          color: '#475569', order: 7  },
    { name: 'MDF',             icon: 'mdi:layers',             color: '#b45309', order: 8  },
    { name: 'Plywood',         icon: 'mdi:layers-triple',      color: '#92400e', order: 9  },
    { name: 'Laminate',        icon: 'mdi:square',             color: '#c9a87c', order: 10 },
    { name: 'Fabric',          icon: 'mdi:texture-box',        color: '#ec4899', order: 11 },
    { name: 'Leather',         icon: 'mdi:square-rounded',     color: '#7c2d12', order: 12 },
    { name: 'Aluminium',       icon: 'mdi:circle-outline',     color: '#94a3b8', order: 13 },
    { name: 'Stainless Steel', icon: 'mdi:silverware',         color: '#64748b', order: 14 },
];

const listMaterials = async (req, res) => {
    try {
        let items = await Material.find({ deleted: { $ne: true } }).sort({ order: 1, createdAt: 1 });
        if (items.length === 0) {
            await Material.insertMany(SEED);
            items = await Material.find({ deleted: { $ne: true } }).sort({ order: 1 });
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching materials' });
    }
};

const addMaterial = async (req, res) => {
    try {
        const { name, icon, color } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const existing = await Material.findOne({ name: name.trim() });
        if (existing) return res.status(400).json({ success: false, message: 'Material already exists' });
        const count = await Material.countDocuments();
        const item = new Material({ name: name.trim(), icon: icon || 'check', color: color || '#c9a87c', order: count + 1 });
        await item.save();
        broadcast({ type: 'materialsChanged' });
        res.json({ success: true, message: 'Material added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding material' });
    }
};

const removeMaterial = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await Material.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'materialsChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing material' });
    }
};

const reorderMaterials = async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'Order array required' });
        await Promise.all(order.map(({ _id, order: o }) => Material.findByIdAndUpdate(_id, { order: o })));
        broadcast({ type: 'materialsChanged' });
        res.json({ success: true, message: 'Order saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving order' });
    }
};

export { listMaterials, addMaterial, removeMaterial, reorderMaterials };
