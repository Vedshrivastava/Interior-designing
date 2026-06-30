import Application from '../models/application.js';
import { broadcast } from '../middlewares/webSocket.js';

const SEED = [
    { name: 'Residential', icon: 'mdi:home',                 color: '#3b82f6', order: 1  },
    { name: 'Commercial',  icon: 'mdi:office-building',       color: '#8b5cf6', order: 2  },
    { name: 'Hospitality', icon: 'mdi:bed',                   color: '#ec4899', order: 3  },
    { name: 'Office',      icon: 'mdi:briefcase',             color: '#64748b', order: 4  },
    { name: 'Retail',      icon: 'mdi:storefront',            color: '#f59e0b', order: 5  },
    { name: 'Healthcare',  icon: 'mdi:hospital-box',          color: '#ef4444', order: 6  },
    { name: 'Outdoor',     icon: 'mdi:tree',                  color: '#22c55e', order: 7  },
    { name: 'Garden',      icon: 'mdi:flower',                color: '#10b981', order: 8  },
    { name: 'Rooftop',     icon: 'mdi:home-roof',             color: '#f97316', order: 9  },
    { name: 'Balcony',     icon: 'mdi:balcony',                color: '#06b6d4', order: 10 },
    { name: 'Industrial',  icon: 'mdi:factory',               color: '#78716c', order: 11 },
    { name: 'Education',   icon: 'mdi:school',                color: '#6366f1', order: 12 },
];

const listApplications = async (req, res) => {
    try {
        let items = await Application.find({ deleted: { $ne: true } }).sort({ order: 1, createdAt: 1 });
        if (items.length === 0) {
            await Application.insertMany(SEED);
            items = await Application.find({ deleted: { $ne: true } }).sort({ order: 1 });
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching applications' });
    }
};

const addApplication = async (req, res) => {
    try {
        const { name, icon, color } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const existing = await Application.findOne({ name: name.trim() });
        if (existing) return res.status(400).json({ success: false, message: 'Application already exists' });
        const count = await Application.countDocuments();
        const item = new Application({ name: name.trim(), icon: icon || 'check', color: color || '#c9a87c', order: count + 1 });
        await item.save();
        broadcast({ type: 'applicationsChanged' });
        res.json({ success: true, message: 'Application added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding application' });
    }
};

const removeApplication = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await Application.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'applicationsChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing application' });
    }
};

const reorderApplications = async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'Order array required' });
        await Promise.all(order.map(({ _id, order: o }) => Application.findByIdAndUpdate(_id, { order: o })));
        broadcast({ type: 'applicationsChanged' });
        res.json({ success: true, message: 'Order saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving order' });
    }
};

export { listApplications, addApplication, removeApplication, reorderApplications };
