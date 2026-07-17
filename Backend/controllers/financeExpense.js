import FinanceExpense from '../models/financeExpense.js';
import FinanceExpensePayment from '../models/financeExpensePayment.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

// paidAmount/balance are computed fresh on every read, never stored — same
// convention as every other ledger in this codebase (Vendor/Contractor/
// Commission Ledger, Receivables).
//
// An expense paid at entry (paymentMode or bankAccountId set on the expense
// itself) never gets a financeExpensePayment row — the full amount moved
// as a side effect of addExpense, so it reads as fully paid directly from
// that same signal. Only an expense with neither (the accrual path) looks
// to financeExpensePayment for what's actually been settled so far.
const withBalances = async (items) => {
    if (!items.length) return items;
    const accrualIds = items.filter(i => !i.paymentMode && !i.bankAccountId).map(i => i._id);
    const paymentAgg = accrualIds.length ? await FinanceExpensePayment.aggregate([
        { $match: { expenseId: { $in: accrualIds }, deleted: { $ne: true } } },
        { $group: { _id: '$expenseId', total: { $sum: '$amount' } } },
    ]) : [];
    const paidByExpense = new Map(paymentAgg.map(r => [r._id.toString(), r.total]));
    return items.map(i => {
        const paidAtEntry = !!(i.paymentMode || i.bankAccountId);
        const paidAmount = paidAtEntry ? i.amount : (paidByExpense.get(i._id.toString()) || 0);
        return { ...i.toObject(), paidAmount, balance: i.amount - paidAmount };
    });
};

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
        const items = await FinanceExpense.find(filter)
            .populate('bankAccountId', 'accountName').populate('projectId', 'name')
            .populate('workId', 'workType').populate('relatedToId', 'name')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: await withBalances(items) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching expenses' });
    }
};

// Two payment shapes coexist on the same model:
//   - Paid at entry (the original, still-default behavior): caller supplies
//     paymentMode and/or bankAccountId, so a financeCashEntry is created
//     immediately for the full amount, exactly as before this changed.
//   - Accrual (new): caller supplies neither — the expense is saved with no
//     cash-entry side effect at all, "pending" until settled later via one
//     or more financeExpensePayment rows (see controllers/financeExpensePayment.js).
// Which path ran is never stored as its own flag — it's always derived from
// whether payment info was actually given, so old records (which always
// went through the paid-at-entry path) read correctly with no migration.
const addExpense = async (req, res) => {
    try {
        const { expenseCategory, projectId, workId, relatedToType, relatedToId, amount, date, paymentMode, bankOrCashLabel, bankAccountId, notes } = req.body;
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceExpense({
            expenseCategory: expenseCategory || '', projectId: projectId || null, workId: workId || null, amount: Number(amount), date,
            relatedToType: relatedToId ? (relatedToType || null) : null, relatedToId: relatedToId || null,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null,
            notes: notes || '',
        });
        await item.save();

        const hasPaymentInfo = !!(paymentMode || bankAccountId);
        if (hasPaymentInfo && !bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount), projectId: projectId || null,
                reason: expenseCategory ? `Expense — ${expenseCategory}` : 'Expense', relatedExpenseId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        }

        broadcast({ type: 'financeExpensesChanged', projectId: projectId || null });

        await logActivity({
            eventType: 'expense_recorded',
            entityType: 'financeExpense',
            entityId: item._id,
            projectId: projectId || null,
            summary: `Expense of ₹${Number(amount)} recorded — ${expenseCategory || 'General'}`,
            amount: Number(amount),
            req,
        });

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
        const paymentCount = await FinanceExpensePayment.countDocuments({ expenseId: _id, deleted: { $ne: true } });
        if (paymentCount > 0) {
            return res.status(400).json({ success: false, message: 'This expense has payments recorded against it — remove those first' });
        }
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
