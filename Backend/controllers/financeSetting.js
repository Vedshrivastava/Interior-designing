import FinanceSetting from '../models/financeSetting.js';
import { broadcast } from '../middlewares/webSocket.js';

const VALID_TYPES = ['work_type', 'expense_category', 'payment_mode', 'tds_section'];

// TDS section rates are fixed by law, not editable business preference —
// seeded once so Payment Tracker/TDS calculations have real defaults.
const TDS_SEED = [
    { settingType: 'tds_section', name: '194C — Contractor (Individual/HUF)', code: '194C-IND', rate: 1,  order: 1 },
    { settingType: 'tds_section', name: '194C — Contractor (Company/Firm)',   code: '194C-CO',  rate: 2,  order: 2 },
    { settingType: 'tds_section', name: '194J — Professional/Technical Fees', code: '194J',     rate: 10, order: 3 },
    { settingType: 'tds_section', name: '194H — Commission/Brokerage',        code: '194H',     rate: 5,  order: 4 },
    { settingType: 'tds_section', name: '194I — Rent',                        code: '194I',     rate: 10, order: 5 },
];

const listFinanceSettings = async (req, res) => {
    try {
        const { settingType } = req.query;
        if (!settingType || !VALID_TYPES.includes(settingType)) {
            return res.status(400).json({ success: false, message: 'A valid settingType is required' });
        }

        let items = await FinanceSetting.find({ settingType, deleted: { $ne: true } }).sort({ order: 1, createdAt: 1 });
        if (items.length === 0 && settingType === 'tds_section') {
            await FinanceSetting.insertMany(TDS_SEED);
            items = await FinanceSetting.find({ settingType, deleted: { $ne: true } }).sort({ order: 1 });
        }
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching settings' });
    }
};

const addFinanceSetting = async (req, res) => {
    try {
        const { settingType, name, code, rate } = req.body;
        if (!settingType || !VALID_TYPES.includes(settingType)) {
            return res.status(400).json({ success: false, message: 'A valid settingType is required' });
        }
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

        const existing = await FinanceSetting.findOne({ settingType, name: name.trim() });
        if (existing) return res.status(400).json({ success: false, message: 'Already exists' });

        const count = await FinanceSetting.countDocuments({ settingType });
        const item = new FinanceSetting({
            settingType, name: name.trim(), code: code || '', rate: rate ?? null, order: count + 1,
        });
        await item.save();
        broadcast({ type: 'financeSettingsChanged', settingType });
        res.json({ success: true, message: 'Added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding setting' });
    }
};

const removeFinanceSetting = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceSetting.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeSettingsChanged', settingType: item.settingType });
        res.json({ success: true, message: `"${item.name}" removed` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing setting' });
    }
};

export { listFinanceSettings, addFinanceSetting, removeFinanceSetting };
