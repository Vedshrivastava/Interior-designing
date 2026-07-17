import { v2 as cloudinary } from 'cloudinary';
import FinanceVendor from '../models/financeVendor.js';
import { broadcast } from '../middlewares/webSocket.js';
import { uploadDocumentsWithNotes, addDocumentToRecord, removeDocumentFromRecord } from '../utils/uploadDocuments.js';

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const listFinanceVendors = async (req, res) => {
    try {
        const items = await FinanceVendor.find({ deleted: { $ne: true } }).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching vendors' });
    }
};

const addFinanceVendor = async (req, res) => {
    try {
        const { name, vendorType, phone, email, address, gstNumber, commissionTypeLabel, notes } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

        let documentNotes = [];
        if (req.body.documentNotes) {
            try { documentNotes = JSON.parse(req.body.documentNotes); } catch { documentNotes = []; }
        }
        const documents = await uploadDocumentsWithNotes(req.files, documentNotes, 'vendor_documents');

        const item = new FinanceVendor({
            name: name.trim(), vendorType, phone, email, address, gstNumber,
            commissionTypeLabel: commissionTypeLabel || '', notes, documents,
        });
        await item.save();
        broadcast({ type: 'financeVendorsChanged' });
        res.json({ success: true, message: 'Vendor added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding vendor' });
    }
};

const updateFinanceVendor = async (req, res) => {
    try {
        const { _id, name, vendorType, phone, email, address, gstNumber, commissionTypeLabel, notes } = req.body;
        const existing = await FinanceVendor.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Vendor not found' });
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        await FinanceVendor.findByIdAndUpdate(_id, {
            name: name.trim(), vendorType, phone, email, address, gstNumber,
            commissionTypeLabel: commissionTypeLabel || '', notes,
        });
        broadcast({ type: 'financeVendorsChanged' });
        res.json({ success: true, message: 'Vendor updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating vendor' });
    }
};

const removeFinanceVendor = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceVendor.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeVendorsChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing vendor' });
    }
};

const addVendorDocument = async (req, res) => {
    try {
        const { vendorId, note } = req.body;
        if (!vendorId) return res.status(400).json({ success: false, message: 'Vendor is required' });
        if (!req.file) return res.status(400).json({ success: false, message: 'A file is required' });
        const item = await addDocumentToRecord(FinanceVendor, vendorId, req.file, note, 'vendor_documents');
        if (!item) return res.status(404).json({ success: false, message: 'Vendor not found' });
        broadcast({ type: 'financeVendorsChanged' });
        res.json({ success: true, message: 'Document added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding document' });
    }
};

const removeVendorDocument = async (req, res) => {
    try {
        const { vendorId, documentId } = req.body;
        const item = await removeDocumentFromRecord(FinanceVendor, vendorId, documentId);
        if (!item) return res.status(404).json({ success: false, message: 'Vendor not found' });
        broadcast({ type: 'financeVendorsChanged' });
        res.json({ success: true, message: 'Document removed', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing document' });
    }
};

export { listFinanceVendors, addFinanceVendor, updateFinanceVendor, removeFinanceVendor, addVendorDocument, removeVendorDocument };
