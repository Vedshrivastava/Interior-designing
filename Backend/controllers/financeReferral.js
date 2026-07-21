import { v2 as cloudinary } from 'cloudinary';
import FinanceReferral from '../models/financeReferral.js';
import { broadcast } from '../middlewares/webSocket.js';
import { uploadDocumentsWithNotes, addDocumentToRecord, removeDocumentFromRecord } from '../utils/uploadDocuments.js';

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const listFinanceReferrals = async (req, res) => {
    try {
        const items = await FinanceReferral.find({ deleted: { $ne: true } }).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching referrals' });
    }
};

const addFinanceReferral = async (req, res) => {
    try {
        const { name, phone, email, address, gstNumber, accountName, bankName, accountNumber, ifscCode, commissionTypeLabel, notes } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!accountName || !bankName || !accountNumber || !ifscCode) {
            return res.status(400).json({ success: false, message: 'Bank account holder name, bank name, account number, and IFSC code are all required' });
        }

        let documentNotes = [];
        if (req.body.documentNotes) {
            try { documentNotes = JSON.parse(req.body.documentNotes); } catch { documentNotes = []; }
        }
        const documents = await uploadDocumentsWithNotes(req.files, documentNotes, 'referral_documents');

        const item = new FinanceReferral({
            name: name.trim(), phone, email, address, gstNumber,
            accountName, bankName, accountNumber, ifscCode,
            commissionTypeLabel: commissionTypeLabel || '', notes, documents,
        });
        await item.save();
        broadcast({ type: 'financeReferralsChanged' });
        res.json({ success: true, message: 'Referral added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding referral' });
    }
};

const updateFinanceReferral = async (req, res) => {
    try {
        const { _id, name, phone, email, address, gstNumber, accountName, bankName, accountNumber, ifscCode, commissionTypeLabel, notes } = req.body;
        const existing = await FinanceReferral.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Referral not found' });
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!accountName || !bankName || !accountNumber || !ifscCode) {
            return res.status(400).json({ success: false, message: 'Bank account holder name, bank name, account number, and IFSC code are all required' });
        }
        await FinanceReferral.findByIdAndUpdate(_id, {
            name: name.trim(), phone, email, address, gstNumber,
            accountName, bankName, accountNumber, ifscCode,
            commissionTypeLabel: commissionTypeLabel || '', notes,
        });
        broadcast({ type: 'financeReferralsChanged' });
        res.json({ success: true, message: 'Referral updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating referral' });
    }
};

const removeFinanceReferral = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceReferral.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeReferralsChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing referral' });
    }
};

const addReferralDocument = async (req, res) => {
    try {
        const { referralId, note } = req.body;
        if (!referralId) return res.status(400).json({ success: false, message: 'Referral is required' });
        if (!req.file) return res.status(400).json({ success: false, message: 'A file is required' });
        const item = await addDocumentToRecord(FinanceReferral, referralId, req.file, note, 'referral_documents');
        if (!item) return res.status(404).json({ success: false, message: 'Referral not found' });
        broadcast({ type: 'financeReferralsChanged' });
        res.json({ success: true, message: 'Document added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding document' });
    }
};

const removeReferralDocument = async (req, res) => {
    try {
        const { referralId, documentId } = req.body;
        const item = await removeDocumentFromRecord(FinanceReferral, referralId, documentId);
        if (!item) return res.status(404).json({ success: false, message: 'Referral not found' });
        broadcast({ type: 'financeReferralsChanged' });
        res.json({ success: true, message: 'Document removed', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing document' });
    }
};

export { listFinanceReferrals, addFinanceReferral, updateFinanceReferral, removeFinanceReferral, addReferralDocument, removeReferralDocument };
