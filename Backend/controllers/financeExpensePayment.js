import FinanceExpensePayment from '../models/financeExpensePayment.js';
import FinanceExpense from '../models/financeExpense.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listExpensePayments = async (req, res) => {
    try {
        const { expenseId } = req.query;
        if (!expenseId) return res.status(400).json({ success: false, message: 'expenseId is required' });
        const items = await FinanceExpensePayment.find({ expenseId, deleted: { $ne: true } })
            .populate('bankAccountId', 'accountName')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching expense payments' });
    }
};

// bankAccountId means bank (the bank statement reads it directly); no
// bankAccountId means cash — a financeCashEntry is auto-created below.
// Same pattern as every other payment controller in this build.
const addExpensePayment = async (req, res) => {
    try {
        const { expenseId, amount, date, paymentMode, bankOrCashLabel, bankAccountId, notes } = req.body;
        if (!expenseId) return res.status(400).json({ success: false, message: 'Expense is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const expense = await FinanceExpense.findOne({ _id: expenseId, deleted: { $ne: true } });
        if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });

        const item = new FinanceExpensePayment({
            expenseId, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null,
            notes: notes || '',
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount), projectId: expense.projectId || null,
                reason: `Expense payment — ${expense.expenseCategory || 'General'}`, relatedExpensePaymentId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        }

        broadcast({ type: 'financeExpensePaymentsChanged', expenseId });
        broadcast({ type: 'financeExpensesChanged', projectId: expense.projectId || null });

        await logActivity({
            eventType: 'expense_paid',
            entityType: 'financeExpensePayment',
            entityId: item._id,
            projectId: expense.projectId || null,
            summary: `₹${Number(amount)} paid against expense — ${expense.expenseCategory || 'General'}`,
            amount: Number(amount),
            req,
        });

        res.json({ success: true, message: 'Payment recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording expense payment' });
    }
};

const removeExpensePayment = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceExpensePayment.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceCashEntry.updateMany(
            { relatedExpensePaymentId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeExpensePaymentsChanged', expenseId: item.expenseId });
        broadcast({ type: 'financeCashBookChanged' });
        res.json({ success: true, message: 'Payment removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing expense payment' });
    }
};

export { listExpensePayments, addExpensePayment, removeExpensePayment };
