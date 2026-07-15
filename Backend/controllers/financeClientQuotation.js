import FinanceClientQuotation from '../models/financeClientQuotation.js';
import FinanceClient from '../models/financeClient.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const STATUS_LABEL = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', expired: 'Expired' };

const listClientQuotations = async (req, res) => {
    try {
        const { clientId } = req.query;
        const filter = { deleted: { $ne: true } };
        if (clientId) filter.clientId = clientId;
        const items = await FinanceClientQuotation.find(filter).sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching quotations' });
    }
};

const addClientQuotation = async (req, res) => {
    try {
        const { clientId, date, amount, validUntil, notes } = req.body;
        if (!clientId) return res.status(400).json({ success: false, message: 'Client is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
        if (amount === undefined || amount === '') return res.status(400).json({ success: false, message: 'Amount is required' });

        const client = await FinanceClient.findById(clientId);
        if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

        const count = await FinanceClientQuotation.countDocuments({ clientId });
        const quotationNumber = String(count + 1);

        const item = new FinanceClientQuotation({
            clientId, quotationNumber, date, amount, validUntil: validUntil || null, notes,
        });
        await item.save();

        broadcast({ type: 'financeClientQuotationsChanged' });
        await logActivity({
            eventType: 'client_quotation_issued', entityType: 'financeClientQuotation', entityId: item._id,
            summary: `Quotation #${quotationNumber} issued to ${client.name} — ₹${amount}`,
            amount, req,
        });

        res.json({ success: true, message: 'Quotation added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding quotation' });
    }
};

const updateClientQuotationStatus = async (req, res) => {
    try {
        const { _id, status } = req.body;
        if (!['pending', 'accepted', 'rejected', 'expired'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }
        const item = await FinanceClientQuotation.findById(_id).populate('clientId', 'name');
        if (!item) return res.status(404).json({ success: false, message: 'Quotation not found' });

        item.status = status;
        await item.save();

        broadcast({ type: 'financeClientQuotationsChanged' });
        await logActivity({
            eventType: 'client_quotation_status_changed', entityType: 'financeClientQuotation', entityId: item._id,
            summary: `Quotation #${item.quotationNumber} for ${item.clientId?.name || 'client'} marked ${STATUS_LABEL[status]}`,
            req,
        });

        res.json({ success: true, message: `Quotation marked ${STATUS_LABEL[status]}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating quotation status' });
    }
};

const removeClientQuotation = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceClientQuotation.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeClientQuotationsChanged' });
        res.json({ success: true, message: `Quotation #${item.quotationNumber} removed` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing quotation' });
    }
};

export { listClientQuotations, addClientQuotation, updateClientQuotationStatus, removeClientQuotation };
