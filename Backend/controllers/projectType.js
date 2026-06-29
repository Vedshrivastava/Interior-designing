import ProjectType from '../models/projectType.js';
import { broadcast } from '../middlewares/webSocket.js';

const SEED = [
    { name: 'Residential', order: 1 },
    { name: 'Commercial',  order: 2 },
];

const listProjectTypes = async (req, res) => {
    try {
        let items = await ProjectType.find({ deleted: { $ne: true } }).sort({ order: 1, createdAt: 1 });
        if (items.length === 0) {
            await ProjectType.insertMany(SEED);
            items = await ProjectType.find({ deleted: { $ne: true } }).sort({ order: 1 });
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching project types' });
    }
};

const addProjectType = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const existing = await ProjectType.findOne({ name: name.trim() });
        if (existing) return res.status(400).json({ success: false, message: 'Type already exists' });
        const count = await ProjectType.countDocuments();
        const item = new ProjectType({ name: name.trim(), order: count + 1 });
        await item.save();
        broadcast({ type: 'projectTypesChanged' });
        res.json({ success: true, message: 'Project type added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding project type' });
    }
};

const removeProjectType = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await ProjectType.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Type not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'projectTypesChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing project type' });
    }
};

const reorderProjectTypes = async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'Order array required' });
        await Promise.all(order.map(({ _id, order: o }) => ProjectType.findByIdAndUpdate(_id, { order: o })));
        broadcast({ type: 'projectTypesChanged' });
        res.json({ success: true, message: 'Order saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving order' });
    }
};

export { listProjectTypes, addProjectType, removeProjectType, reorderProjectTypes };
