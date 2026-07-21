import { v2 as cloudinary } from 'cloudinary';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import { broadcast } from '../middlewares/webSocket.js';
import { uploadDocumentsWithNotes, addDocumentToRecord, removeDocumentFromRecord } from '../utils/uploadDocuments.js';
import { assertLabourProviderVendor } from '../utils/contractorVendor.js';

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
        const { name, accountName, bankName, accountNumber, ifscCode, notes, labourProviderVendorId, labourProviderRatePerSqft } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!accountName || !bankName || !accountNumber || !ifscCode) {
            return res.status(400).json({ success: false, message: 'Bank account holder name, bank name, account number, and IFSC code are all required' });
        }
        // Optional, but a real pairing — a provider with no rate (or a rate
        // with no provider) can't compute anything, so both or neither.
        if (labourProviderVendorId) {
            if (!labourProviderRatePerSqft || Number(labourProviderRatePerSqft) <= 0) {
                return res.status(400).json({ success: false, message: 'Labour provider rate (₹/sqft) is required when a labour provider is set' });
            }
            try {
                await assertLabourProviderVendor(labourProviderVendorId);
            } catch (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
        }

        let documentNotes = [];
        if (req.body.documentNotes) {
            try { documentNotes = JSON.parse(req.body.documentNotes); } catch { documentNotes = []; }
        }
        const documents = await uploadDocumentsWithNotes(req.files, documentNotes, 'labourer_documents');

        const item = new FinanceLabourer({
            name: name.trim(), accountName, bankName, accountNumber, ifscCode, notes: notes || '', documents,
            labourProviderVendorId: labourProviderVendorId || null,
            labourProviderRatePerSqft: labourProviderVendorId ? Number(labourProviderRatePerSqft) : null,
        });
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
        const { _id, name, accountName, bankName, accountNumber, ifscCode, notes, labourProviderVendorId, labourProviderRatePerSqft } = req.body;
        const existing = await FinanceLabourer.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Labourer not found' });
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!accountName || !bankName || !accountNumber || !ifscCode) {
            return res.status(400).json({ success: false, message: 'Bank account holder name, bank name, account number, and IFSC code are all required' });
        }
        if (labourProviderVendorId) {
            if (!labourProviderRatePerSqft || Number(labourProviderRatePerSqft) <= 0) {
                return res.status(400).json({ success: false, message: 'Labour provider rate (₹/sqft) is required when a labour provider is set' });
            }
            try {
                await assertLabourProviderVendor(labourProviderVendorId);
            } catch (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
        }
        await FinanceLabourer.findByIdAndUpdate(_id, {
            name: name.trim(), accountName, bankName, accountNumber, ifscCode, notes: notes || '',
            labourProviderVendorId: labourProviderVendorId || null,
            labourProviderRatePerSqft: labourProviderVendorId ? Number(labourProviderRatePerSqft) : null,
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

const addLabourerDocument = async (req, res) => {
    try {
        const { labourerId, note } = req.body;
        if (!labourerId) return res.status(400).json({ success: false, message: 'Labourer is required' });
        if (!req.file) return res.status(400).json({ success: false, message: 'A file is required' });
        const item = await addDocumentToRecord(FinanceLabourer, labourerId, req.file, note, 'labourer_documents');
        if (!item) return res.status(404).json({ success: false, message: 'Labourer not found' });
        broadcast({ type: 'financeLabourersChanged' });
        res.json({ success: true, message: 'Document added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding document' });
    }
};

const removeLabourerDocument = async (req, res) => {
    try {
        const { labourerId, documentId } = req.body;
        const item = await removeDocumentFromRecord(FinanceLabourer, labourerId, documentId);
        if (!item) return res.status(404).json({ success: false, message: 'Labourer not found' });
        broadcast({ type: 'financeLabourersChanged' });
        res.json({ success: true, message: 'Document removed', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing document' });
    }
};

export { listLabourers, addLabourer, updateLabourer, removeLabourer, addLabourerDocument, removeLabourerDocument };
