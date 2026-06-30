import Finish from '../models/finish.js';
import { broadcast } from '../middlewares/webSocket.js';

const SEED = [
    { name: 'Matte',         icon: 'mdi:circle-half-full',  color: '#64748b', order: 1  },
    { name: 'Polished',      icon: 'mdi:shimmer',           color: '#0ea5e9', order: 2  },
    { name: 'Glossy',        icon: 'mdi:water',             color: '#3b82f6', order: 3  },
    { name: 'Textured',      icon: 'mdi:grain',             color: '#a16207', order: 4  },
    { name: 'Brushed',       icon: 'mdi:gesture-double-tap',color: '#78716c', order: 5  },
    { name: 'Rough Cast',    icon: 'mdi:texture-box',       color: '#92400e', order: 6  },
    { name: 'Natural',       icon: 'mdi:leaf',              color: '#22c55e', order: 7  },
    { name: 'Lacquered',     icon: 'mdi:spray',             color: '#ec4899', order: 8  },
    { name: 'Antique',       icon: 'mdi:clock-outline',     color: '#a16207', order: 9  },
    { name: 'Powder Coated', icon: 'mdi:dots-hexagon',      color: '#6366f1', order: 10 },
];

const listFinishes = async (req, res) => {
    try {
        let items = await Finish.find({ deleted: { $ne: true } }).sort({ order: 1, createdAt: 1 });
        if (items.length === 0) {
            await Finish.insertMany(SEED);
            items = await Finish.find({ deleted: { $ne: true } }).sort({ order: 1 });
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching finishes' });
    }
};

const addFinish = async (req, res) => {
    try {
        const { name, icon, color } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const existing = await Finish.findOne({ name: name.trim() });
        if (existing) return res.status(400).json({ success: false, message: 'Finish already exists' });
        const count = await Finish.countDocuments();
        const item = new Finish({ name: name.trim(), icon: icon || 'check', color: color || '#c9a87c', order: count + 1 });
        await item.save();
        broadcast({ type: 'finishesChanged' });
        res.json({ success: true, message: 'Finish added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding finish' });
    }
};

const removeFinish = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await Finish.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'finishesChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing finish' });
    }
};

const reorderFinishes = async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'Order array required' });
        await Promise.all(order.map(({ _id, order: o }) => Finish.findByIdAndUpdate(_id, { order: o })));
        broadcast({ type: 'finishesChanged' });
        res.json({ success: true, message: 'Order saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving order' });
    }
};

export { listFinishes, addFinish, removeFinish, reorderFinishes };
