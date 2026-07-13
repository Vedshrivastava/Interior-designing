import FinanceBankTransfer from '../models/financeBankTransfer.js';
import FinanceBankAccount from '../models/financeBankAccount.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listBankTransfers = async (req, res) => {
    try {
        const { accountId } = req.query;
        const filter = { deleted: { $ne: true } };
        if (accountId) filter.$or = [{ fromAccountId: accountId }, { toAccountId: accountId }];
        const items = await FinanceBankTransfer.find(filter)
            .populate('fromAccountId', 'accountName')
            .populate('toAccountId', 'accountName')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching transfers' });
    }
};

const addBankTransfer = async (req, res) => {
    try {
        const { fromAccountId, toAccountId, amount, date, notes } = req.body;
        if (!fromAccountId || !toAccountId) return res.status(400).json({ success: false, message: 'From and To accounts are required' });
        if (fromAccountId === toAccountId) return res.status(400).json({ success: false, message: 'From and To accounts must be different' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceBankTransfer({ fromAccountId, toAccountId, amount: Number(amount), date, notes: notes || '' });
        await item.save();
        broadcast({ type: 'financeBankAccountsChanged' });

        const [fromAccount, toAccount] = await Promise.all([
            FinanceBankAccount.findById(fromAccountId).select('accountName'),
            FinanceBankAccount.findById(toAccountId).select('accountName'),
        ]);
        await logActivity({
            eventType: 'bank_transfer',
            entityType: 'financeBankTransfer',
            entityId: item._id,
            summary: `₹${Number(amount)} transferred from ${fromAccount?.accountName || 'account'} to ${toAccount?.accountName || 'account'}`,
            amount: Number(amount),
            req,
        });

        res.json({ success: true, message: 'Transfer recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording transfer' });
    }
};

const removeBankTransfer = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceBankTransfer.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeBankAccountsChanged' });
        res.json({ success: true, message: 'Transfer removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing transfer' });
    }
};

export { listBankTransfers, addBankTransfer, removeBankTransfer };
