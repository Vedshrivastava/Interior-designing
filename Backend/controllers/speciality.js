import Speciality from '../models/speciality.js';
import { broadcast } from '../middlewares/webSocket.js';

const SEED = [
    { name: 'Waterproof',         icon: 'mdi:water',                     color: '#3b82f6', order: 1  },
    { name: 'UV Protection',      icon: 'mdi:weather-sunny',             color: '#f59e0b', order: 2  },
    { name: 'Fire Resistant',     icon: 'mdi:fire',                      color: '#ef4444', order: 3  },
    { name: 'Weather Resistant',  icon: 'mdi:weather-cloudy',            color: '#6366f1', order: 4  },
    { name: 'Eco-Friendly',       icon: 'mdi:leaf',                      color: '#22c55e', order: 5  },
    { name: 'Low Maintenance',    icon: 'mdi:wrench',                    color: '#8b5cf6', order: 6  },
    { name: 'Anti-Fungal',        icon: 'mdi:shield-check',              color: '#14b8a6', order: 7  },
    { name: 'Sound Insulation',   icon: 'mdi:volume-off',                color: '#ec4899', order: 8  },
    { name: 'Thermal Insulation', icon: 'mdi:thermometer',               color: '#f97316', order: 9  },
    { name: 'Scratch Resistant',  icon: 'mdi:shield-alert',              color: '#64748b', order: 10 },
    { name: 'Fade Resistant',     icon: 'mdi:sun-wireless',              color: '#a78bfa', order: 11 },
    { name: 'Customizable',       icon: 'mdi:pencil',                    color: '#c9a87c', order: 12 },
    { name: 'Non-Toxic',          icon: 'mdi:leaf-circle',               color: '#10b981', order: 13 },
    { name: 'Rust Resistant',     icon: 'mdi:shield-half-full',          color: '#78716c', order: 14 },
];

const listSpecialities = async (req, res) => {
    try {
        let items = await Speciality.find({ deleted: { $ne: true } }).sort({ order: 1, createdAt: 1 });
        if (items.length === 0) {
            await Speciality.insertMany(SEED);
            items = await Speciality.find({ deleted: { $ne: true } }).sort({ order: 1 });
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching specialities' });
    }
};

const addSpeciality = async (req, res) => {
    try {
        const { name, icon, color } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const existing = await Speciality.findOne({ name: name.trim() });
        if (existing) return res.status(400).json({ success: false, message: 'Speciality already exists' });
        const count = await Speciality.countDocuments();
        const item = new Speciality({ name: name.trim(), icon: icon || 'check', color: color || '#c9a87c', order: count + 1 });
        await item.save();
        broadcast({ type: 'specialitiesChanged' });
        res.json({ success: true, message: 'Speciality added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding speciality' });
    }
};

const removeSpeciality = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await Speciality.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'specialitiesChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing speciality' });
    }
};

const reorderSpecialities = async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'Order array required' });
        await Promise.all(order.map(({ _id, order: o }) => Speciality.findByIdAndUpdate(_id, { order: o })));
        broadcast({ type: 'specialitiesChanged' });
        res.json({ success: true, message: 'Order saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving order' });
    }
};

export { listSpecialities, addSpeciality, removeSpeciality, reorderSpecialities };
