import ProductCategory from '../models/productCategory.js';
import { broadcast } from '../middlewares/webSocket.js';

const SEED = [
    { name: 'Interior',                icon: 'mdi:sofa',               color: '#3b82f6', order: 1 },
    { name: 'Exterior',                icon: 'mdi:home-city-outline',  color: '#22c55e', order: 2 },
    { name: 'Functional Architecture', icon: 'mdi:cube-outline',       color: '#8b5cf6', order: 3 },
];

const listProductCategories = async (req, res) => {
    try {
        let items = await ProductCategory.find({ deleted: { $ne: true } }).sort({ order: 1, createdAt: 1 });
        if (items.length === 0) {
            await ProductCategory.insertMany(SEED);
            items = await ProductCategory.find({ deleted: { $ne: true } }).sort({ order: 1 });
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching product categories' });
    }
};

const addProductCategory = async (req, res) => {
    try {
        const { name, icon, color } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const existing = await ProductCategory.findOne({ name: name.trim() });
        if (existing) return res.status(400).json({ success: false, message: 'Category already exists' });
        const count = await ProductCategory.countDocuments();
        const item = new ProductCategory({ name: name.trim(), icon: icon || 'check', color: color || '#c9a87c', order: count + 1 });
        await item.save();
        broadcast({ type: 'productCategoriesChanged' });
        res.json({ success: true, message: 'Category added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding category' });
    }
};

const removeProductCategory = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await ProductCategory.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'productCategoriesChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing category' });
    }
};

const reorderProductCategories = async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'Order array required' });
        await Promise.all(order.map(({ _id, order: o }) => ProductCategory.findByIdAndUpdate(_id, { order: o })));
        broadcast({ type: 'productCategoriesChanged' });
        res.json({ success: true, message: 'Order saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving order' });
    }
};

export { listProductCategories, addProductCategory, removeProductCategory, reorderProductCategories };
