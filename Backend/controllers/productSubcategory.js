import ProductSubcategory from '../models/productSubcategory.js';
import { broadcast } from '../middlewares/webSocket.js';

const SEED = [
    { name: 'Ceilings',           icon: 'mdi:ceiling-light',       color: '#3b82f6', categories: ['Interior'], order: 1  },
    { name: 'Wall Features',      icon: 'mdi:wall',                color: '#8b5cf6', categories: ['Interior'], order: 2  },
    { name: 'Flooring',           icon: 'mdi:view-grid-outline',   color: '#f59e0b', categories: ['Interior'], order: 3  },
    { name: 'Lighting',           icon: 'mdi:lightbulb-on-outline',color: '#eab308', categories: ['Interior'], order: 4  },
    { name: 'Furniture',          icon: 'mdi:sofa-outline',        color: '#ec4899', categories: ['Interior'], order: 5  },
    { name: 'Facades',            icon: 'mdi:office-building-outline', color: '#22c55e', categories: ['Exterior'], order: 6  },
    { name: 'Cladding',           icon: 'mdi:layers-outline',      color: '#14b8a6', categories: ['Exterior'], order: 7  },
    { name: 'Landscaping',        icon: 'mdi:tree-outline',        color: '#16a34a', categories: ['Exterior'], order: 8  },
    { name: 'Pergolas',           icon: 'mdi:gazebo',              color: '#0891b2', categories: ['Exterior'], order: 9  },
    { name: 'Breeze Blocks',      icon: 'mdi:grid',                color: '#64748b', categories: ['Functional Architecture'], order: 10 },
    { name: 'Jaali Walls',        icon: 'mdi:texture-box',         color: '#78716c', categories: ['Functional Architecture'], order: 11 },
    { name: 'Decorative Screens', icon: 'mdi:view-comfy',          color: '#a78bfa', categories: ['Functional Architecture'], order: 12 },
    { name: 'Feature Walls',      icon: 'mdi:image-frame',         color: '#dc2626', categories: ['Functional Architecture'], order: 13 },
    { name: 'Privacy Screens',    icon: 'mdi:eye-off-outline',     color: '#6366f1', categories: ['Functional Architecture'], order: 14 },
];

const listProductSubcategories = async (req, res) => {
    try {
        let items = await ProductSubcategory.find({ deleted: { $ne: true } }).sort({ order: 1, createdAt: 1 });
        if (items.length === 0) {
            await ProductSubcategory.insertMany(SEED);
            items = await ProductSubcategory.find({ deleted: { $ne: true } }).sort({ order: 1 });
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching product subcategories' });
    }
};

const addProductSubcategory = async (req, res) => {
    try {
        const { name, icon, color, categories } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!categories || !Array.isArray(categories) || categories.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one parent category is required' });
        }
        const existing = await ProductSubcategory.findOne({ name: name.trim() });
        if (existing) return res.status(400).json({ success: false, message: 'Subcategory already exists' });
        const count = await ProductSubcategory.countDocuments();
        const item = new ProductSubcategory({
            name: name.trim(), icon: icon || 'check', color: color || '#c9a87c',
            categories, order: count + 1,
        });
        await item.save();
        broadcast({ type: 'productSubcategoriesChanged' });
        res.json({ success: true, message: 'Subcategory added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding subcategory' });
    }
};

const removeProductSubcategory = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await ProductSubcategory.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'productSubcategoriesChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing subcategory' });
    }
};

const reorderProductSubcategories = async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'Order array required' });
        await Promise.all(order.map(({ _id, order: o }) => ProductSubcategory.findByIdAndUpdate(_id, { order: o })));
        broadcast({ type: 'productSubcategoriesChanged' });
        res.json({ success: true, message: 'Order saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving order' });
    }
};

export { listProductSubcategories, addProductSubcategory, removeProductSubcategory, reorderProductSubcategories };
