import FinanceBankEntry from '../models/financeBankEntry.js';
import FinanceBankAccount from '../models/financeBankAccount.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listBankEntries = async (req, res) => {
    try {
        const { bankAccountId, projectId } = req.query;
        const filter = { deleted: { $ne: true } };
        if (bankAccountId) filter.bankAccountId = bankAccountId;
        if (projectId) filter.projectId = projectId;
        const items = await FinanceBankEntry.find(filter).populate('bankAccountId', 'accountName').sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching bank entries' });
    }
};

// Always manual — money moving into/out of a bank account with no
// originating receipt/payment/transfer (capital injected, a loan disbursed,
// interest credited, or a correction against the real bank statement). See
// financeBankAccount.js's getAccountActivity, which folds these in
// alongside every other bank-account-tagged record.
const addBankEntry = async (req, res) => {
    try {
        const { date, type, amount, bankAccountId, projectId, reason, notes } = req.body;
        if (!['in', 'out'].includes(type)) return res.status(400).json({ success: false, message: 'type must be in or out' });
        if (!bankAccountId) return res.status(400).json({ success: false, message: 'Bank account is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!reason || !reason.trim()) return res.status(400).json({ success: false, message: 'Reason is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const account = await FinanceBankAccount.findOne({ _id: bankAccountId, deleted: { $ne: true } });
        if (!account) return res.status(404).json({ success: false, message: 'Bank account not found' });

        const item = new FinanceBankEntry({
            date, type, amount: Number(amount), bankAccountId, projectId: projectId || null, reason: reason.trim(), notes: notes || '',
        });
        await item.save();
        broadcast({ type: 'financeBankAccountsChanged' });

        await logActivity({
            eventType: type === 'in' ? 'bank_entry_in' : 'bank_entry_out',
            entityType: 'financeBankEntry',
            entityId: item._id,
            projectId: projectId || null,
            summary: `${type === 'in' ? 'Manual deposit into' : 'Manual withdrawal from'} ${account.accountName} — ${reason.trim()}`,
            entityNames: [account.accountName],
            amount: Number(amount),
            req,
        });

        res.json({ success: true, message: 'Bank entry recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording bank entry' });
    }
};

const removeBankEntry = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceBankEntry.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeBankAccountsChanged' });

        const account = await FinanceBankAccount.findById(item.bankAccountId).select('accountName');
        await logActivity({
            eventType: 'bank_entry_deleted',
            entityType: 'financeBankEntry',
            entityId: item._id,
            projectId: item.projectId || null,
            summary: `${item.type === 'in' ? 'Manual deposit into' : 'Manual withdrawal from'} ${account?.accountName || 'account'} deleted`,
            entityNames: account ? [account.accountName] : [],
            amount: item.amount,
            req,
        });

        res.json({ success: true, message: 'Bank entry removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing bank entry' });
    }
};

export { listBankEntries, addBankEntry, removeBankEntry };
