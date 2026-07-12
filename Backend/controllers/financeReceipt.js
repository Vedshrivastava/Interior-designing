import FinanceReceipt from '../models/financeReceipt.js';
import { broadcast } from '../middlewares/webSocket.js';

const listReceipts = async (req, res) => {
    try {
        const { projectId, clientId } = req.query;
        if (!projectId && !clientId) {
            return res.status(400).json({ success: false, message: 'projectId or clientId is required' });
        }
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        if (clientId) filter.clientId = clientId;
        const items = await FinanceReceipt.find(filter)
            .populate('runningBillId', 'billNumber')
            .sort({ receiptDate: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching receipts' });
    }
};

// Just creates the record — the receivable balance is always computed on
// read (see controllers/financeReceivable.js), never decremented here.
// No bank-balance update: Bank isn't a real ledger yet (still a nav-only
// placeholder), so there's nothing to update. Wire this up once Bank is
// built for real, alongside Site Inventory's equivalent stock ledger.
const addReceipt = async (req, res) => {
    try {
        const { clientId, projectId, runningBillId, amount, receiptDate, paymentMode, bankOrCashLabel, utrNumber, notes } = req.body;
        if (!clientId || !projectId) return res.status(400).json({ success: false, message: 'Client and project are required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!receiptDate) return res.status(400).json({ success: false, message: 'Receipt date is required' });

        const item = new FinanceReceipt({
            clientId, projectId,
            runningBillId: runningBillId || null,
            amount: Number(amount), receiptDate,
            paymentMode: paymentMode || '',
            bankOrCashLabel: bankOrCashLabel || '',
            utrNumber: utrNumber || '',
            notes: notes || '',
        });
        await item.save();
        broadcast({ type: 'financeReceiptsChanged', projectId, clientId });
        res.json({ success: true, message: 'Receipt recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording receipt' });
    }
};

const removeReceipt = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceReceipt.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeReceiptsChanged', projectId: item.projectId, clientId: item.clientId });
        res.json({ success: true, message: 'Receipt removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing receipt' });
    }
};

export { listReceipts, addReceipt, removeReceipt };
