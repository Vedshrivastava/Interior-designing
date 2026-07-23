import FinanceReceipt from '../models/financeReceipt.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import FinanceClient from '../models/financeClient.js';
import FinanceProject from '../models/financeProject.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

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
            .populate('bankAccountId', 'accountName')
            .sort({ receiptDate: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching receipts' });
    }
};

// Just creates the record — the receivable balance is always computed on
// read (see controllers/financeReceivable.js), never decremented here.
// bankAccountId means bank (the bank statement reads it directly, see
// controllers/financeBankAccount.js); no bankAccountId means cash — a
// financeCashEntry is auto-created below so the Cash Book stays complete.
const addReceipt = async (req, res) => {
    try {
        const { clientId, projectId, runningBillId, amount, receiptDate, paymentMode, bankOrCashLabel, bankAccountId, utrNumber, notes } = req.body;
        if (!clientId || !projectId) return res.status(400).json({ success: false, message: 'Client and project are required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!receiptDate) return res.status(400).json({ success: false, message: 'Receipt date is required' });

        const item = new FinanceReceipt({
            clientId, projectId,
            runningBillId: runningBillId || null,
            amount: Number(amount), receiptDate,
            paymentMode: paymentMode || '',
            bankOrCashLabel: bankOrCashLabel || '',
            bankAccountId: bankAccountId || null,
            utrNumber: utrNumber || '',
            notes: notes || '',
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date: receiptDate, type: 'in', amount: Number(amount), projectId,
                reason: 'Client receipt', relatedReceiptId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        } else {
            broadcast({ type: 'financeBankAccountsChanged' });
        }

        broadcast({ type: 'financeReceiptsChanged', projectId, clientId });

        const [client, project] = await Promise.all([
            FinanceClient.findById(clientId).select('name'),
            FinanceProject.findById(projectId).select('name'),
        ]);
        await logActivity({
            eventType: 'receipt_received',
            entityType: 'financeReceipt',
            entityId: item._id,
            projectId,
            summary: `₹${Number(amount)} received from ${client?.name || 'client'} for ${project?.name || 'project'}`,
            amount: Number(amount),
            req,
        });

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
        await FinanceCashEntry.updateMany(
            { relatedReceiptId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeReceiptsChanged', projectId: item.projectId, clientId: item.clientId });
        broadcast({ type: 'financeCashBookChanged' });
        if (item.bankAccountId) broadcast({ type: 'financeBankAccountsChanged' });
        res.json({ success: true, message: 'Receipt removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing receipt' });
    }
};

export { listReceipts, addReceipt, removeReceipt };
