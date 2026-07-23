import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';
import FinanceVendorPayment from '../models/financeVendorPayment.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import FinanceVendor from '../models/financeVendor.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

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
        const items = await FinanceVendorPayment.find(filter).populate('bankAccountId', 'accountName').populate('tdsSectionId', 'name code').sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching payments' });
    }
};

const uploadAttachment = async (file) => {
    if (!file) return '';
    try {
        // resource_type 'raw' — Cloudinary blocks public delivery of PDF/ZIP
        // files uploaded as image/video by default; raw delivery serves the
        // file as-is and isn't subject to that ACL block (same fix already
        // applied to every other document-attachment upload in this app —
        // see uploadDocuments.js's header comment).
        const result = await cloudinary.uploader.upload(file.path, { folder: 'vendor_payment_attachments', resource_type: 'raw' });
        fs.unlinkSync(file.path);
        return result.secure_url;
    } catch (uploadError) {
        console.error(`Error uploading attachment ${file.path}:`, uploadError);
        return '';
    }
};

// bankAccountId means bank (the bank statement reads it directly); no
// bankAccountId means cash — a financeCashEntry is auto-created below.
const addVendorPayment = async (req, res) => {
    try {
        const { vendorId, projectId, purchaseId, amount, date, paymentMode, bankOrCashLabel, bankAccountId, utrNumber, notes, tdsSectionId, tdsAmount } = req.body;
        if (!vendorId) return res.status(400).json({ success: false, message: 'Vendor is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const attachmentUrl = await uploadAttachment(req.file);

        const item = new FinanceVendorPayment({
            vendorId, projectId: projectId || null, purchaseId: purchaseId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null, utrNumber: utrNumber || '',
            attachmentUrl, notes: notes || '',
            tdsSectionId: tdsSectionId || null, tdsAmount: (tdsAmount !== undefined && tdsAmount !== '') ? Number(tdsAmount) : null,
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount), projectId: projectId || null,
                reason: 'Vendor payment', relatedVendorPaymentId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        } else {
            broadcast({ type: 'financeBankAccountsChanged' });
        }

        broadcast({ type: 'financeVendorLedgerChanged', vendorId });

        const vendor = await FinanceVendor.findById(vendorId).select('name');
        await logActivity({
            eventType: 'vendor_paid',
            entityType: 'financeVendorPayment',
            entityId: item._id,
            projectId: projectId || null,
            summary: `₹${Number(amount)} paid to vendor ${vendor?.name || 'vendor'}`,
            amount: Number(amount),
            req,
        });

        res.json({ success: true, message: 'Payment recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording payment' });
    }
};

const updateVendorPayment = async (req, res) => {
    try {
        const { _id, projectId, purchaseId, amount, date, paymentMode, bankOrCashLabel, utrNumber, notes, tdsSectionId, tdsAmount } = req.body;
        const existing = await FinanceVendorPayment.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const update = {
            projectId: projectId || null, purchaseId: purchaseId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', utrNumber: utrNumber || '', notes: notes || '',
            tdsSectionId: tdsSectionId || null, tdsAmount: (tdsAmount !== undefined && tdsAmount !== '') ? Number(tdsAmount) : null,
        };
        if (req.file) update.attachmentUrl = await uploadAttachment(req.file);

        await FinanceVendorPayment.findByIdAndUpdate(_id, update);
        broadcast({ type: 'financeVendorLedgerChanged', vendorId: existing.vendorId });
        if (existing.bankAccountId) broadcast({ type: 'financeBankAccountsChanged' });
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
        await FinanceCashEntry.updateMany(
            { relatedVendorPaymentId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeVendorLedgerChanged', vendorId: item.vendorId });
        broadcast({ type: 'financeCashBookChanged' });
        if (item.bankAccountId) broadcast({ type: 'financeBankAccountsChanged' });
        res.json({ success: true, message: 'Payment removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing payment' });
    }
};

export { listVendorPayments, addVendorPayment, updateVendorPayment, removeVendorPayment };
