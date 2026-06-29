import ProjectCategory from '../models/projectCategory.js';
import { broadcast } from '../middlewares/webSocket.js';

const SEED = [
    'Full Home Interior', 'Kitchen', 'Bedroom', 'Living Room',
    'Bathroom', 'TV Unit', 'Kids Room', 'Commercial', 'Office',
    'Villa / Bungalow', 'Apartment', 'Renovation', 'Housing Society',
].map((name, i) => ({ name, order: i + 1 }));

const listProjectCategories = async (req, res) => {
    try {
        let items = await ProjectCategory.find({ deleted: { $ne: true } }).sort({ order: 1, createdAt: 1 });
        if (items.length === 0) {
            await ProjectCategory.insertMany(SEED);
            items = await ProjectCategory.find({ deleted: { $ne: true } }).sort({ order: 1 });
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching project categories' });
    }
};

const addProjectCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const existing = await ProjectCategory.findOne({ name: name.trim() });
        if (existing) return res.status(400).json({ success: false, message: 'Category already exists' });
        const count = await ProjectCategory.countDocuments();
        const item = new ProjectCategory({ name: name.trim(), order: count + 1 });
        await item.save();
        broadcast({ type: 'projectCategoriesChanged' });
        res.json({ success: true, message: 'Category added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding project category' });
    }
};

const removeProjectCategory = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await ProjectCategory.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Category not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'projectCategoriesChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing project category' });
    }
};

const reorderProjectCategories = async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'Order array required' });
        await Promise.all(order.map(({ _id, order: o }) => ProjectCategory.findByIdAndUpdate(_id, { order: o })));
        broadcast({ type: 'projectCategoriesChanged' });
        res.json({ success: true, message: 'Order saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving order' });
    }
};

export { listProjectCategories, addProjectCategory, removeProjectCategory, reorderProjectCategories };
