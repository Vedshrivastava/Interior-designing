import { v2 as cloudinary } from 'cloudinary';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import { broadcast } from '../middlewares/webSocket.js';
import { uploadDocumentsWithNotes } from '../utils/uploadDocuments.js';

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const listLabourers = async (req, res) => {
    try {
        const items = await FinanceLabourer.find({ deleted: { $ne: true } }).sort({ name: 1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching labourers' });
    }
};

const addLabourer = async (req, res) => {
    try {
        const { name, notes } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

        let documentNotes = [];
        if (req.body.documentNotes) {
            try { documentNotes = JSON.parse(req.body.documentNotes); } catch { documentNotes = []; }
        }
        const documents = await uploadDocumentsWithNotes(req.files, documentNotes, 'labourer_documents');

        const item = new FinanceLabourer({ name: name.trim(), notes: notes || '', documents });
        await item.save();
        broadcast({ type: 'financeLabourersChanged' });
        res.json({ success: true, message: 'Labourer added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding labourer' });
    }
};

const updateLabourer = async (req, res) => {
    try {
        const { _id, name, notes } = req.body;
        const existing = await FinanceLabourer.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Labourer not found' });
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
        await FinanceLabourer.findByIdAndUpdate(_id, {
            name: name.trim(), notes: notes || '',
        });
        broadcast({ type: 'financeLabourersChanged' });
        res.json({ success: true, message: 'Labourer updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating labourer' });
    }
};

const removeLabourer = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceLabourer.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Labourer not found' });
        const entryCount = await FinanceLabourMeasurement.countDocuments({ labourerId: _id, deleted: { $ne: true } });
        if (entryCount > 0) {
            return res.status(400).json({ success: false, message: 'This labourer has measurements recorded against them — remove those first' });
        }
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeLabourersChanged' });
        res.json({ success: true, message: 'Labourer removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing labourer' });
    }
};

export { listLabourers, addLabourer, updateLabourer, removeLabourer };
