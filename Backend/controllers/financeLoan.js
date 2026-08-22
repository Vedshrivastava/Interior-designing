import FinanceLoan from '../models/financeLoan.js';
import FinanceLoanRepayment from '../models/financeLoanRepayment.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

// Never stored — principal minus the principal portion (amount minus
// interestPortion) of every non-deleted repayment against this loan.
const computeOutstanding = async (loanId, principal) => {
    const repayments = await FinanceLoanRepayment.find({ loanId, deleted: { $ne: true } }, 'amount interestPortion');
    const principalPaid = repayments.reduce((s, r) => s + (r.amount - (r.interestPortion || 0)), 0);
    return Math.round((principal - principalPaid + Number.EPSILON) * 100) / 100;
};

const listLoans = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { deleted: { $ne: true } };
        if (status) filter.status = status;
        const loans = await FinanceLoan.find(filter).populate('bankAccountId', 'accountName').sort({ dateTaken: -1 });
        const data = await Promise.all(loans.map(async (loan) => ({
            ...loan.toObject(),
            outstandingBalance: await computeOutstanding(loan._id, loan.principal),
        })));
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching loans' });
    }
};

const addLoan = async (req, res) => {
    try {
        const { lenderName, principal, dateTaken, interestRate, bankAccountId, bankOrCashLabel, notes } = req.body;
        if (!lenderName || !lenderName.trim()) return res.status(400).json({ success: false, message: 'Lender is required' });
        if (!principal || Number(principal) <= 0) return res.status(400).json({ success: false, message: 'A valid principal amount is required' });
        if (!dateTaken) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceLoan({
            lenderName: lenderName.trim(), principal: Number(principal), dateTaken,
            interestRate: (interestRate !== undefined && interestRate !== '') ? Number(interestRate) : null,
            bankAccountId: bankAccountId || null, bankOrCashLabel: bankOrCashLabel || '',
            notes: notes || '',
        });
        await item.save();

        // Same convention as every payment type — bank mode shows up in
        // that account's own balance directly (getAccountActivity); cash
        // mode needs an explicit Cash Book entry.
        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date: dateTaken, type: 'in', amount: Number(principal),
                reason: `Loan received — ${item.lenderName}`, relatedLoanId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        } else {
            broadcast({ type: 'financeBankAccountsChanged' });
        }

        broadcast({ type: 'financeLoansChanged' });

        await logActivity({
            eventType: 'loan_added',
            entityType: 'financeLoan',
            entityId: item._id,
            summary: `Loan taken — ₹${item.principal.toLocaleString('en-IN')} from ${item.lenderName}`,
            entityNames: [item.lenderName],
            amount: item.principal,
            req,
        });

        res.json({ success: true, message: 'Loan added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding loan' });
    }
};

const closeLoan = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceLoan.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.status = item.status === 'closed' ? 'active' : 'closed';
        await item.save();

        broadcast({ type: 'financeLoansChanged' });

        res.json({ success: true, message: item.status === 'closed' ? 'Loan marked closed' : 'Loan reopened', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating loan' });
    }
};

const removeLoan = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceLoan.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        const repaymentCount = await FinanceLoanRepayment.countDocuments({ loanId: _id, deleted: { $ne: true } });
        if (repaymentCount > 0) return res.status(400).json({ success: false, message: 'Remove its repayments first' });

        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();

        // Same reversal pattern as removeLoanRepayment — the cash entry
        // auto-created when this loan's principal was received in cash
        // shouldn't stay stranded once the loan record itself is gone.
        await FinanceCashEntry.updateMany(
            { relatedLoanId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeCashBookChanged' });
        broadcast({ type: 'financeLoansChanged' });

        await logActivity({
            eventType: 'loan_deleted',
            entityType: 'financeLoan',
            entityId: item._id,
            summary: `Loan deleted — ${item.lenderName}`,
            entityNames: [item.lenderName],
            req,
        });

        res.json({ success: true, message: 'Loan removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing loan' });
    }
};

const listLoanRepayments = async (req, res) => {
    try {
        const { loanId } = req.query;
        if (!loanId) return res.status(400).json({ success: false, message: 'loanId is required' });
        const items = await FinanceLoanRepayment.find({ loanId, deleted: { $ne: true } })
            .populate('bankAccountId', 'accountName').sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching repayments' });
    }
};

const addLoanRepayment = async (req, res) => {
    try {
        const { loanId, date, amount, interestPortion, bankAccountId, bankOrCashLabel, notes } = req.body;
        const loan = await FinanceLoan.findOne({ _id: loanId, deleted: { $ne: true } });
        if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'A valid amount is required' });
        const resolvedInterest = (interestPortion !== undefined && interestPortion !== '') ? Number(interestPortion) : 0;
        if (resolvedInterest > Number(amount)) return res.status(400).json({ success: false, message: 'Interest portion can\'t exceed the total amount' });

        const item = new FinanceLoanRepayment({
            loanId, date, amount: Number(amount), interestPortion: resolvedInterest,
            bankAccountId: bankAccountId || null, bankOrCashLabel: bankOrCashLabel || '',
            notes: notes || '',
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount),
                reason: `Loan repayment — ${loan.lenderName}`, relatedLoanRepaymentId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        } else {
            broadcast({ type: 'financeBankAccountsChanged' });
        }

        broadcast({ type: 'financeLoansChanged' });

        await logActivity({
            eventType: 'loan_repaid',
            entityType: 'financeLoanRepayment',
            entityId: item._id,
            summary: `Loan repayment — ₹${item.amount.toLocaleString('en-IN')} to ${loan.lenderName}`,
            entityNames: [loan.lenderName],
            amount: item.amount,
            req,
        });

        res.json({ success: true, message: 'Repayment recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording repayment' });
    }
};

const removeLoanRepayment = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceLoanRepayment.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();

        // Cascade — mirrors removePurchase/financeContractorPayment's
        // reversal pattern (the auto-created cash entry doesn't stay
        // stranded once its originating record is gone).
        await FinanceCashEntry.updateMany(
            { relatedLoanRepaymentId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );

        broadcast({ type: 'financeCashBookChanged' });
        broadcast({ type: 'financeLoansChanged' });

        res.json({ success: true, message: 'Repayment removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing repayment' });
    }
};

export { listLoans, addLoan, closeLoan, removeLoan, listLoanRepayments, addLoanRepayment, removeLoanRepayment, computeOutstanding };
