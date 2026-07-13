import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';
import FinanceVendorPayment from '../models/financeVendorPayment.js';
import { broadcast } from '../middlewares/webSocket.js';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const listVendorPayments = async (req, res) => {
    try {
        const { vendorId, projectId } = req.query;
        if (!vendorId && !projectId) return res.status(400).json({ success: false, message: 'vendorId or projectId is required' });
        const filter = { deleted: { $ne: true } };
        if (vendorId) filter.vendorId = vendorId;
        if (projectId) filter.projectId = projectId;
        const items = await FinanceVendorPayment.find(filter).sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching payments' });
    }
};

const uploadAttachment = async (file) => {
    if (!file) return '';
    try {
        const result = await cloudinary.uploader.upload(file.path, { folder: 'vendor_payment_attachments' });
        fs.unlinkSync(file.path);
        return result.secure_url;
    } catch (uploadError) {
        console.error(`Error uploading attachment ${file.path}:`, uploadError);
        return '';
    }
};

const addVendorPayment = async (req, res) => {
    try {
        const { vendorId, projectId, purchaseId, amount, date, paymentMode, bankOrCashLabel, utrNumber, notes } = req.body;
        if (!vendorId) return res.status(400).json({ success: false, message: 'Vendor is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const attachmentUrl = await uploadAttachment(req.file);

        const item = new FinanceVendorPayment({
            vendorId, projectId: projectId || null, purchaseId: purchaseId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', utrNumber: utrNumber || '',
            attachmentUrl, notes: notes || '',
        });
        await item.save();
        broadcast({ type: 'financeVendorLedgerChanged', vendorId });
        res.json({ success: true, message: 'Payment recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording payment' });
    }
};

const updateVendorPayment = async (req, res) => {
    try {
        const { _id, projectId, purchaseId, amount, date, paymentMode, bankOrCashLabel, utrNumber, notes } = req.body;
        const existing = await FinanceVendorPayment.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const update = {
            projectId: projectId || null, purchaseId: purchaseId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', utrNumber: utrNumber || '', notes: notes || '',
        };
        if (req.file) update.attachmentUrl = await uploadAttachment(req.file);

        await FinanceVendorPayment.findByIdAndUpdate(_id, update);
        broadcast({ type: 'financeVendorLedgerChanged', vendorId: existing.vendorId });
        res.json({ success: true, message: 'Payment updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating payment' });
    }
};

const removeVendorPayment = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceVendorPayment.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeVendorLedgerChanged', vendorId: item.vendorId });
        res.json({ success: true, message: 'Payment removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing payment' });
    }
};

export { listVendorPayments, addVendorPayment, updateVendorPayment, removeVendorPayment };
