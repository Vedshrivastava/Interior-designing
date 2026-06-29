import Category from '../models/category.js';

const SEED_CATEGORIES = [
    { name: 'Kitchen Designs',      slug: 'kitchen-designs',      label: 'Kitchen',   order: 1 },
    { name: 'Bedroom Designs',      slug: 'bedroom-designs',      label: 'Bedroom',   order: 2 },
    { name: 'Bathroom Designs',     slug: 'bathroom-designs',     label: 'Bathroom',  order: 3 },
    { name: 'Lounge area Designs',  slug: 'lounge-area-designs',  label: 'Lounge',    order: 4 },
    { name: 'Kids Room Designs',    slug: 'kids-room-designs',    label: 'Kids Room', order: 5 },
    { name: 'TV Unit Designs',      slug: 'tv-unit-designs',      label: 'TV Unit',   order: 6 },
    { name: 'Commercial Designs',   slug: 'commercial-designs',   label: 'Commercial',order: 7 },
    { name: 'Mandir Designs',       slug: 'mandir-designs',       label: 'Mandir',    order: 8 },
    { name: 'Garden Designs',       slug: 'garden-designs',       label: 'Garden',    order: 9 },
    { name: 'House Exterior',       slug: 'house-exterior',       label: 'Exterior',  order: 10 },
];

const listCategories = async (req, res) => {
    try {
        let categories = await Category.find().sort({ order: 1, createdAt: 1 });

        // Auto-seed on first call if collection is empty
        if (categories.length === 0) {
            await Category.insertMany(SEED_CATEGORIES);
            categories = await Category.find().sort({ order: 1 });
        }

        res.json({ success: true, data: categories });
    } catch (error) {
        console.error('Error listing categories:', error);
        res.status(500).json({ success: false, message: 'Error fetching categories' });
    }
};

const addCategory = async (req, res) => {
    try {
        const { name, label } = req.body;

        if (!name || !label) {
            return res.status(400).json({ success: false, message: 'Name and label are required' });
        }

        const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const existing = await Category.findOne({ $or: [{ slug }, { name: name.trim() }] });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Category already exists' });
        }

        const count = await Category.countDocuments();
        const category = new Category({ name: name.trim(), slug, label: label.trim(), order: count + 1 });
        await category.save();

        res.json({ success: true, message: 'Category added', data: category });
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ success: false, message: 'Error adding category' });
    }
};

export { listCategories, addCategory };
