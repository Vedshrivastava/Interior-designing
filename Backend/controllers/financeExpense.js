import fs from 'fs';
import FinanceExpense from '../models/financeExpense.js';
import FinanceExpensePayment from '../models/financeExpensePayment.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';
import { uploadRawFile, resolveDeliveryUrl } from '../utils/uploadDocuments.js';

// A reimbursement claim (an expense tagged to the employee/labourer who
// actually paid it) needs proof it's genuine — everything else keeps
// attachmentUrl fully optional, same as before this existed.
const REIMBURSEMENT_TYPES = ['financeEmployee', 'financeLabourer'];

const uploadAttachment = async (file) => {
    if (!file) return '';
    try {
        const url = await uploadRawFile(file.path, 'expense_attachments');
        fs.unlinkSync(file.path);
        return url;
    } catch (uploadError) {
        console.error(`Error uploading attachment ${file.path}:`, uploadError);
        return '';
    }
};

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
        return { ...i.toObject(), paidAmount, balance: i.amount - paidAmount, attachmentUrl: resolveDeliveryUrl(i.attachmentUrl) };
    });
};

const listExpenses = async (req, res) => {
    try {
        const { projectId, expenseCategory, relatedToId, dateFrom, dateTo } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) {
            filter.projectId = projectId;
            // A company-overhead expense can still carry a projectId (cost
            // attribution — see addExpense), but it belongs on Payables'
            // Company Expenses tab, not a project's own Expenses tab, even
            // when tagged to one — those two views are otherwise identical
            // (same component, same endpoint), so the split has to happen
            // here. Financial rollups (Project Profit/cost) are unaffected —
            // they query FinanceExpense directly, never through this list.
            filter.relatedToType = { $ne: 'financeCompanySettings' };
        }
        if (expenseCategory) filter.expenseCategory = expenseCategory;
        if (relatedToId) filter.relatedToId = relatedToId;
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) filter.date.$lte = new Date(dateTo);
        }
        const items = await FinanceExpense.find(filter)
            .populate('bankAccountId', 'accountName').populate('projectId', 'name')
            .populate('workId', 'workType').populate('relatedToId', 'name companyName')
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
        const { expenseCategory, projectId, workId, relatedToType, relatedToId, amount, date, paymentMode, bankOrCashLabel, bankAccountId, notes, gstRate } = req.body;
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const resolvedRelatedToType = relatedToId ? (relatedToType || null) : null;
        // Hard block, backend-enforced — a reimbursement claim with no proof
        // it's genuine defeats the point of tracking it at all, so this
        // can't be skipped client-side.
        if (REIMBURSEMENT_TYPES.includes(resolvedRelatedToType) && !req.file) {
            return res.status(400).json({ success: false, message: 'A bill/receipt attachment is required for employee and labourer reimbursement claims' });
        }
        const attachmentUrl = await uploadAttachment(req.file);

        // gstAmount is always server-derived from amount × gstRate (never
        // trusted from the client) — same convention financePurchase.js
        // uses for its own identical fields. A reimbursement claim never
        // gets GST at all, regardless of what's sent: Input Tax Credit
        // requires the tax invoice to bear the COMPANY's own GSTIN, and an
        // employee/labourer's personal out-of-pocket bill essentially never
        // does — enforced here, not just by hiding the field on the
        // Reimbursements form, since this is the only place a wrong ITC
        // claim can actually leak into the CA Monthly Package's numbers.
        const hasGst = !REIMBURSEMENT_TYPES.includes(resolvedRelatedToType) && gstRate !== undefined && gstRate !== null && gstRate !== '';
        const item = new FinanceExpense({
            expenseCategory: expenseCategory || '', projectId: projectId || null, workId: workId || null, amount: Number(amount), date,
            relatedToType: resolvedRelatedToType, relatedToId: relatedToId || null,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null,
            attachmentUrl, notes: notes || '',
            gstRate: hasGst ? Number(gstRate) : null, gstAmount: hasGst ? Number(amount) * (Number(gstRate) / 100) : null,
        });
        await item.save();

        const hasPaymentInfo = !!(paymentMode || bankAccountId);
        if (hasPaymentInfo && !bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount), projectId: projectId || null,
                reason: expenseCategory ? `Expense — ${expenseCategory}` : 'Expense', relatedExpenseId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        } else if (bankAccountId) {
            broadcast({ type: 'financeBankAccountsChanged' });
        }

        broadcast({ type: 'financeExpensesChanged', projectId: projectId || null });

        await logActivity({
            eventType: 'expense_recorded',
            entityType: 'financeExpense',
            entityId: item._id,
            projectId: projectId || null,
            summary: `Expense recorded — ${expenseCategory || 'General'}`,
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
        const { _id, expenseCategory, projectId, amount, date, paymentMode, bankOrCashLabel, notes, gstRate } = req.body;
        const existing = await FinanceExpense.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
        // Same hard block as addExpense — relatedToType/Id aren't editable
        // here (update never touches them), so this only re-checks a
        // pre-existing reimbursement claim that somehow still has no proof.
        if (REIMBURSEMENT_TYPES.includes(existing.relatedToType) && !req.file && !existing.attachmentUrl) {
            return res.status(400).json({ success: false, message: 'A bill/receipt attachment is required for employee and labourer reimbursement claims' });
        }

        // See addExpense's identical comment — no GST on a reimbursement
        // claim, ever. Also self-heals any row that somehow already has one
        // (e.g. recorded before this rule existed) the next time it's saved.
        const hasGst = !REIMBURSEMENT_TYPES.includes(existing.relatedToType) && gstRate !== undefined && gstRate !== null && gstRate !== '';
        const update = {
            expenseCategory: expenseCategory || '', projectId: projectId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', notes: notes || '',
            gstRate: hasGst ? Number(gstRate) : null, gstAmount: hasGst ? Number(amount) * (Number(gstRate) / 100) : null,
        };
        if (req.file) update.attachmentUrl = await uploadAttachment(req.file);
        await FinanceExpense.findByIdAndUpdate(_id, update);
        broadcast({ type: 'financeExpensesChanged', projectId: projectId || null });
        if (existing.bankAccountId) broadcast({ type: 'financeBankAccountsChanged' });
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
        if (item.bankAccountId) broadcast({ type: 'financeBankAccountsChanged' });

        await logActivity({
            eventType: 'expense_deleted',
            entityType: 'financeExpense',
            entityId: item._id,
            projectId: item.projectId || null,
            summary: `Expense deleted — ${item.expenseCategory || 'General'}`,
            amount: item.amount,
            req,
        });

        res.json({ success: true, message: 'Expense removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing expense' });
    }
};

export { listExpenses, addExpense, updateExpense, removeExpense };
