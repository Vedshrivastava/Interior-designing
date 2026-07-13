import FinanceBankAccount from '../models/financeBankAccount.js';
import FinanceBankTransfer from '../models/financeBankTransfer.js';
import FinanceReceipt from '../models/financeReceipt.js';
import FinanceContractorPayment from '../models/financeContractorPayment.js';
import FinanceVendorPayment from '../models/financeVendorPayment.js';
import FinanceSalaryPayment from '../models/financeSalaryPayment.js';
import FinanceCommissionPayment from '../models/financeCommissionPayment.js';
import FinanceExpense from '../models/financeExpense.js';
import { broadcast } from '../middlewares/webSocket.js';

/*
 * Shared by the account list (for the "Balance" tab) and the statement
 * endpoint below — every receipt/contractor-payment/vendor-payment/salary-
 * payment/commission-payment/expense with this account's bankAccountId
 * set, plus bank transfers in either direction. Current balance is never
 * stored: always openingBalance + this activity, computed fresh every call.
 */
const getAccountActivity = async (accountId) => {
    const filter = { bankAccountId: accountId, deleted: { $ne: true } };
    const [receipts, contractorPayments, vendorPayments, salaryPayments, commissionPayments, expenses, transfersOut, transfersIn] = await Promise.all([
        FinanceReceipt.find(filter),
        FinanceContractorPayment.find(filter),
        FinanceVendorPayment.find(filter),
        FinanceSalaryPayment.find(filter),
        FinanceCommissionPayment.find(filter),
        FinanceExpense.find(filter),
        FinanceBankTransfer.find({ fromAccountId: accountId, deleted: { $ne: true } }),
        FinanceBankTransfer.find({ toAccountId: accountId, deleted: { $ne: true } }),
    ]);

    return [
        ...receipts.map(r => ({ date: r.receiptDate, amount: r.amount, direction: 'credit', description: 'Receipt', sourceType: 'receipt', sourceId: r._id })),
        ...contractorPayments.map(p => ({ date: p.date, amount: p.amount, direction: 'debit', description: 'Contractor payment', sourceType: 'contractorPayment', sourceId: p._id })),
        ...vendorPayments.map(p => ({ date: p.date, amount: p.amount, direction: 'debit', description: 'Vendor payment', sourceType: 'vendorPayment', sourceId: p._id })),
        ...salaryPayments.map(p => ({ date: p.date, amount: p.amount, direction: 'debit', description: 'Salary payment', sourceType: 'salaryPayment', sourceId: p._id })),
        ...commissionPayments.map(p => ({ date: p.date, amount: p.amount, direction: 'debit', description: 'Commission payment', sourceType: 'commissionPayment', sourceId: p._id })),
        ...expenses.map(e => ({ date: e.date, amount: e.amount, direction: 'debit', description: e.expenseCategory ? `Expense — ${e.expenseCategory}` : 'Expense', sourceType: 'expense', sourceId: e._id })),
        ...transfersOut.map(t => ({ date: t.date, amount: t.amount, direction: 'debit', description: 'Transfer out', sourceType: 'transfer', sourceId: t._id })),
        ...transfersIn.map(t => ({ date: t.date, amount: t.amount, direction: 'credit', description: 'Transfer in', sourceType: 'transfer', sourceId: t._id })),
    ];
};

const listBankAccounts = async (req, res) => {
    try {
        const accounts = await FinanceBankAccount.find({ deleted: { $ne: true } }).sort({ createdAt: -1 });
        const withBalance = await Promise.all(accounts.map(async (a) => {
            const activity = await getAccountActivity(a._id);
            const net = activity.reduce((sum, t) => sum + (t.direction === 'credit' ? t.amount : -t.amount), 0);
            return { ...a.toObject(), currentBalance: a.openingBalance + net };
        }));
        res.json({ success: true, data: withBalance });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching bank accounts' });
    }
};

const addBankAccount = async (req, res) => {
    try {
        const { accountName, bankName, accountNumber, ifscCode, accountType, openingBalance, openingBalanceDate, notes } = req.body;
        if (!accountName || !bankName) return res.status(400).json({ success: false, message: 'Account name and bank name are required' });
        if (openingBalance === undefined || openingBalance === '') return res.status(400).json({ success: false, message: 'Opening balance is required' });
        if (!openingBalanceDate) return res.status(400).json({ success: false, message: 'Opening balance date is required' });

        const account = new FinanceBankAccount({
            accountName: accountName.trim(), bankName: bankName.trim(),
            accountNumber: accountNumber || '', ifscCode: ifscCode || '', accountType: accountType || '',
            openingBalance: Number(openingBalance), openingBalanceDate, notes: notes || '',
        });
        await account.save();
        broadcast({ type: 'financeBankAccountsChanged' });
        res.json({ success: true, message: 'Bank account added', data: account });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding bank account' });
    }
};

const updateBankAccount = async (req, res) => {
    try {
        const { _id, accountName, bankName, accountNumber, ifscCode, accountType, openingBalance, openingBalanceDate, notes } = req.body;
        const existing = await FinanceBankAccount.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!accountName || !bankName) return res.status(400).json({ success: false, message: 'Account name and bank name are required' });

        await FinanceBankAccount.findByIdAndUpdate(_id, {
            accountName: accountName.trim(), bankName: bankName.trim(),
            accountNumber: accountNumber || '', ifscCode: ifscCode || '', accountType: accountType || '',
            openingBalance: Number(openingBalance), openingBalanceDate, notes: notes || '',
        });
        broadcast({ type: 'financeBankAccountsChanged' });
        res.json({ success: true, message: 'Bank account updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating bank account' });
    }
};

const removeBankAccount = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceBankAccount.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeBankAccountsChanged' });
        res.json({ success: true, message: `"${item.accountName}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing bank account' });
    }
};

// Running-balance transaction list — opening balance + every credit/debit
// in chronological order.
const getBankStatement = async (req, res) => {
    try {
        const { id } = req.params;
        const account = await FinanceBankAccount.findOne({ _id: id, deleted: { $ne: true } });
        if (!account) return res.status(404).json({ success: false, message: 'Bank account not found' });

        const activity = await getAccountActivity(id);
        activity.sort((a, b) => new Date(a.date) - new Date(b.date));

        let running = account.openingBalance;
        const transactions = activity.map(t => {
            running += t.direction === 'credit' ? t.amount : -t.amount;
            return { ...t, runningBalance: running };
        });

        res.json({
            success: true,
            data: {
                accountId: account._id, accountName: account.accountName,
                openingBalance: account.openingBalance, openingBalanceDate: account.openingBalanceDate,
                currentBalance: running,
                transactions,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing bank statement' });
    }
};

export { listBankAccounts, addBankAccount, updateBankAccount, removeBankAccount, getBankStatement };
