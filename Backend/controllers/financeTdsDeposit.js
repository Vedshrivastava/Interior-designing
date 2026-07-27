import FinanceTdsDeposit from '../models/financeTdsDeposit.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listTdsDeposits = async (req, res) => {
    try {
        const items = await FinanceTdsDeposit.find({ deleted: { $ne: true } })
            .populate('tdsSectionId', 'name code')
            .populate('bankAccountId', 'accountName')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching TDS deposits' });
    }
};

// bankAccountId means bank (the bank statement reads it directly); no
// bankAccountId means cash — a financeCashEntry is auto-created below.
// Same pattern as every other payment controller in this build.
const addTdsDeposit = async (req, res) => {
    try {
        const { amount, date, tdsSectionId, challanNumber, bankAccountId, notes } = req.body;
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceTdsDeposit({
            amount: Number(amount), date, tdsSectionId: tdsSectionId || null,
            challanNumber: challanNumber || '', bankAccountId: bankAccountId || null, notes: notes || '',
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount),
                reason: 'TDS deposit', relatedTdsDepositId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        } else {
            broadcast({ type: 'financeBankAccountsChanged' });
        }

        broadcast({ type: 'financeTdsDepositsChanged' });

        await logActivity({
            eventType: 'tds_deposited',
            entityType: 'financeTdsDeposit',
            entityId: item._id,
            projectId: null,
            summary: `TDS deposited to the tax department${challanNumber ? ` (Challan ${challanNumber})` : ''}`,
            amount: Number(amount),
            req,
        });

        res.json({ success: true, message: 'TDS deposit recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording TDS deposit' });
    }
};

const removeTdsDeposit = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceTdsDeposit.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceCashEntry.updateMany(
            { relatedTdsDepositId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeTdsDepositsChanged' });
        broadcast({ type: 'financeCashBookChanged' });
        if (item.bankAccountId) broadcast({ type: 'financeBankAccountsChanged' });
        res.json({ success: true, message: 'TDS deposit removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing TDS deposit' });
    }
};

export { listTdsDeposits, addTdsDeposit, removeTdsDeposit };
