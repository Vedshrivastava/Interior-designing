import { v2 as cloudinary } from 'cloudinary';
import FinanceLabourProvider from '../models/financeLabourProvider.js';
import { broadcast } from '../middlewares/webSocket.js';
import { uploadDocumentsWithNotes, addDocumentToRecord, removeDocumentFromRecord } from '../utils/uploadDocuments.js';

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const listFinanceLabourProviders = async (req, res) => {
    try {
        const items = await FinanceLabourProvider.find({ deleted: { $ne: true } }).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching labour providers' });
    }
};

const addFinanceLabourProvider = async (req, res) => {
    try {
        const { name, phone, email, address, gstNumber, accountName, bankName, accountNumber, ifscCode, notes } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!accountName || !bankName || !accountNumber || !ifscCode) {
            return res.status(400).json({ success: false, message: 'Bank account holder name, bank name, account number, and IFSC code are all required' });
        }

        let documentNotes = [];
        if (req.body.documentNotes) {
            try { documentNotes = JSON.parse(req.body.documentNotes); } catch { documentNotes = []; }
        }
        const documents = await uploadDocumentsWithNotes(req.files, documentNotes, 'labour_provider_documents');

        const item = new FinanceLabourProvider({
            name: name.trim(), phone, email, address, gstNumber,
            accountName, bankName, accountNumber, ifscCode,
            notes, documents,
        });
        await item.save();
        broadcast({ type: 'financeLabourProvidersChanged' });
        res.json({ success: true, message: 'Labour provider added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding labour provider' });
    }
};

const updateFinanceLabourProvider = async (req, res) => {
    try {
        const { _id, name, phone, email, address, gstNumber, accountName, bankName, accountNumber, ifscCode, notes } = req.body;
        const existing = await FinanceLabourProvider.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Labour provider not found' });
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!accountName || !bankName || !accountNumber || !ifscCode) {
            return res.status(400).json({ success: false, message: 'Bank account holder name, bank name, account number, and IFSC code are all required' });
        }
        await FinanceLabourProvider.findByIdAndUpdate(_id, {
            name: name.trim(), phone, email, address, gstNumber,
            accountName, bankName, accountNumber, ifscCode, notes,
        });
        broadcast({ type: 'financeLabourProvidersChanged' });
        res.json({ success: true, message: 'Labour provider updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating labour provider' });
    }
};

const removeFinanceLabourProvider = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceLabourProvider.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeLabourProvidersChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing labour provider' });
    }
};

const addLabourProviderDocument = async (req, res) => {
    try {
        const { labourProviderId, note } = req.body;
        if (!labourProviderId) return res.status(400).json({ success: false, message: 'Labour provider is required' });
        if (!req.file) return res.status(400).json({ success: false, message: 'A file is required' });
        const item = await addDocumentToRecord(FinanceLabourProvider, labourProviderId, req.file, note, 'labour_provider_documents');
        if (!item) return res.status(404).json({ success: false, message: 'Labour provider not found' });
        broadcast({ type: 'financeLabourProvidersChanged' });
        res.json({ success: true, message: 'Document added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding document' });
    }
};

const removeLabourProviderDocument = async (req, res) => {
    try {
        const { labourProviderId, documentId } = req.body;
        const item = await removeDocumentFromRecord(FinanceLabourProvider, labourProviderId, documentId);
        if (!item) return res.status(404).json({ success: false, message: 'Labour provider not found' });
        broadcast({ type: 'financeLabourProvidersChanged' });
        res.json({ success: true, message: 'Document removed', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing document' });
    }
};

export { listFinanceLabourProviders, addFinanceLabourProvider, updateFinanceLabourProvider, removeFinanceLabourProvider, addLabourProviderDocument, removeLabourProviderDocument };
