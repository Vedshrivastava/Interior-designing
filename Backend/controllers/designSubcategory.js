import DesignSubcategory from '../models/designSubcategory.js';
import { broadcast } from '../middlewares/webSocket.js';

const SEED = [
    { name: 'Modular Kitchen',   icon: 'mdi:countertop',          color: '#f59e0b', categories: ['Kitchen Designs'],       order: 1  },
    { name: 'Island Kitchen',    icon: 'mdi:silverware-fork-knife', color: '#ea580c', categories: ['Kitchen Designs'],     order: 2  },
    { name: 'Master Bedroom',    icon: 'mdi:bed-king-outline',    color: '#8b5cf6', categories: ['Bedroom Designs'],       order: 3  },
    { name: 'Walk-in Wardrobe',  icon: 'mdi:wardrobe-outline',    color: '#6366f1', categories: ['Bedroom Designs'],       order: 4  },
    { name: 'Vanity Units',      icon: 'mdi:sink-outline',        color: '#0891b2', categories: ['Bathroom Designs'],      order: 5  },
    { name: 'Shower Cubicles',   icon: 'mdi:shower-head',         color: '#0ea5e9', categories: ['Bathroom Designs'],      order: 6  },
    { name: 'Seating Area',      icon: 'mdi:sofa-outline',        color: '#ec4899', categories: ['Lounge area Designs'],   order: 7  },
    { name: 'TV Panel',          icon: 'mdi:television',          color: '#3b82f6', categories: ['TV Unit Designs'],       order: 8  },
    { name: 'Bunk Beds',         icon: 'mdi:bunk-bed-outline',    color: '#f97316', categories: ['Kids Room Designs'],     order: 9  },
    { name: 'Study Corner',      icon: 'mdi:desk',                color: '#22c55e', categories: ['Kids Room Designs'],     order: 10 },
    { name: 'Office Cabins',     icon: 'mdi:office-building-outline', color: '#64748b', categories: ['Commercial Designs'], order: 11 },
    { name: 'Reception Area',    icon: 'mdi:desk-lamp',           color: '#78716c', categories: ['Commercial Designs'],    order: 12 },
    { name: 'Pooja Unit',        icon: 'mdi:temple-hindu',        color: '#dc2626', categories: ['Mandir Designs'],        order: 13 },
    { name: 'Vertical Garden',   icon: 'mdi:tree-outline',        color: '#16a34a', categories: ['Garden Designs'],        order: 14 },
    { name: 'Facade',            icon: 'mdi:home-city-outline',   color: '#14b8a6', categories: ['House Exterior'],        order: 15 },
];

const listDesignSubcategories = async (req, res) => {
    try {
        let items = await DesignSubcategory.find({ deleted: { $ne: true } }).sort({ order: 1, createdAt: 1 });
        if (items.length === 0) {
            await DesignSubcategory.insertMany(SEED);
            items = await DesignSubcategory.find({ deleted: { $ne: true } }).sort({ order: 1 });
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching design subcategories' });
    }
};

const addDesignSubcategory = async (req, res) => {
    try {
        const { name, icon, color, categories } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!categories || !Array.isArray(categories) || categories.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one parent category is required' });
        }
        const existing = await DesignSubcategory.findOne({ name: name.trim() });
        if (existing) return res.status(400).json({ success: false, message: 'Subcategory already exists' });
        const count = await DesignSubcategory.countDocuments();
        const item = new DesignSubcategory({
            name: name.trim(), icon: icon || 'check', color: color || '#c9a87c',
            categories, order: count + 1,
        });
        await item.save();
        broadcast({ type: 'designSubcategoriesChanged' });
        res.json({ success: true, message: 'Subcategory added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding subcategory' });
    }
};

const removeDesignSubcategory = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await DesignSubcategory.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'designSubcategoriesChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing subcategory' });
    }
};

const reorderDesignSubcategories = async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'Order array required' });
        await Promise.all(order.map(({ _id, order: o }) => DesignSubcategory.findByIdAndUpdate(_id, { order: o })));
        broadcast({ type: 'designSubcategoriesChanged' });
        res.json({ success: true, message: 'Order saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving order' });
    }
};

export { listDesignSubcategories, addDesignSubcategory, removeDesignSubcategory, reorderDesignSubcategories };
