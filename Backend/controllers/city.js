import City from '../models/city.js';
import { broadcast } from '../middlewares/webSocket.js';

const slugify = (name) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const SEED = [
    { name: 'Satna',    state: 'Madhya Pradesh', slug: 'satna',    variations: ['satna'],           order: 1 },
    { name: 'Nagod',    state: 'Madhya Pradesh', slug: 'nagod',    variations: ['nagod'],           order: 2 },
    { name: 'Indore',   state: 'Madhya Pradesh', slug: 'indore',   variations: ['indore'],          order: 3 },
    { name: 'Bhopal',   state: 'Madhya Pradesh', slug: 'bhopal',   variations: ['bhopal'],          order: 4 },
    { name: 'Jabalpur', state: 'Madhya Pradesh', slug: 'jabalpur', variations: ['jabalpur'],         order: 5 },
    { name: 'Rewa',     state: 'Madhya Pradesh', slug: 'rewa',     variations: ['rewa'],             order: 6 },
    { name: 'Mumbai',   state: 'Maharashtra',    slug: 'mumbai',   variations: ['mumbai', 'bombay'], order: 7 },
    { name: 'Pune',     state: 'Maharashtra',    slug: 'pune',     variations: ['pune'],             order: 8 },
    { name: 'Kolhapur', state: 'Maharashtra',    slug: 'kolhapur', variations: ['kolhapur'],         order: 9 },
];

const listCities = async (req, res) => {
    try {
        let items = await City.find({ deleted: { $ne: true } }).sort({ order: 1, createdAt: 1 });
        if (items.length === 0) {
            await City.insertMany(SEED);
            items = await City.find({ deleted: { $ne: true } }).sort({ order: 1 });
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching cities' });
    }
};

const addCity = async (req, res) => {
    try {
        const { name, state } = req.body;
        if (!name || !state) return res.status(400).json({ success: false, message: 'Name and state are required' });
        const slug = slugify(name);
        if (!slug) return res.status(400).json({ success: false, message: 'Invalid city name' });
        const existing = await City.findOne({ $or: [{ name: name.trim() }, { slug }] });
        if (existing) return res.status(400).json({ success: false, message: 'City already exists' });
        const count = await City.countDocuments();
        const item = new City({
            name: name.trim(),
            state: state.trim(),
            slug,
            variations: [name.trim().toLowerCase()],
            order: count + 1,
        });
        await item.save();
        broadcast({ type: 'citiesChanged' });
        res.json({ success: true, message: 'City added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding city' });
    }
};

const removeCity = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await City.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'citiesChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing city' });
    }
};

const reorderCities = async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'Order array required' });
        await Promise.all(order.map(({ _id, order: o }) => City.findByIdAndUpdate(_id, { order: o })));
        broadcast({ type: 'citiesChanged' });
        res.json({ success: true, message: 'Order saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving order' });
    }
};

export { listCities, addCity, removeCity, reorderCities };
