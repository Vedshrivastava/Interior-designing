import FinanceExpense from '../models/financeExpense.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { broadcast } from '../middlewares/webSocket.js';

const listExpenses = async (req, res) => {
    try {
        const { projectId, expenseCategory, dateFrom, dateTo } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        if (expenseCategory) filter.expenseCategory = expenseCategory;
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) filter.date.$lte = new Date(dateTo);
        }
        const items = await FinanceExpense.find(filter).populate('bankAccountId', 'accountName').populate('projectId', 'name').sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching expenses' });
    }
};

// A straightforward paid-when-entered log — no earned-vs-paid ledger.
// bankAccountId means bank; no bankAccountId means cash — a
// financeCashEntry is auto-created below, same pattern as every other
// payment controller in this build.
const addExpense = async (req, res) => {
    try {
        const { expenseCategory, projectId, amount, date, paymentMode, bankOrCashLabel, bankAccountId, notes } = req.body;
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceExpense({
            expenseCategory: expenseCategory || '', projectId: projectId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null,
            notes: notes || '',
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount), projectId: projectId || null,
                reason: expenseCategory ? `Expense — ${expenseCategory}` : 'Expense', relatedExpenseId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        }

        broadcast({ type: 'financeExpensesChanged', projectId: projectId || null });
        res.json({ success: true, message: 'Expense recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording expense' });
    }
};

const updateExpense = async (req, res) => {
    try {
        const { _id, expenseCategory, projectId, amount, date, paymentMode, bankOrCashLabel, notes } = req.body;
        const existing = await FinanceExpense.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        await FinanceExpense.findByIdAndUpdate(_id, {
            expenseCategory: expenseCategory || '', projectId: projectId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', notes: notes || '',
        });
        broadcast({ type: 'financeExpensesChanged', projectId: projectId || null });
        res.json({ success: true, message: 'Expense updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating expense' });
    }
};

const removeExpense = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceExpense.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceCashEntry.updateMany(
            { relatedExpenseId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeExpensesChanged', projectId: item.projectId });
        broadcast({ type: 'financeCashBookChanged' });
        res.json({ success: true, message: 'Expense removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing expense' });
    }
};

export { listExpenses, addExpense, updateExpense, removeExpense };
