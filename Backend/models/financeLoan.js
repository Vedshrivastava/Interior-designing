import mongoose from 'mongoose';

// A loan taken by the company — lender, principal, when, and (optionally)
// an annual interest rate. Outstanding balance is never stored: computed
// fresh as principal minus the principal portion of every repayment (see
// financeLoanRepayment.js), same anti-drift rule as every other balance
// in this codebase. bankAccountId/bankOrCashLabel describe how the
// principal was actually received — bank mode shows up in that account's
// own balance/statement (financeBankAccount.js's getAccountActivity);
// cash mode auto-creates a matching financeCashEntry (see
// controllers/financeLoan.js), exactly the same convention every payment
// type here already follows.
const financeLoanSchema = new mongoose.Schema({
    lenderName:   { type: String, required: true },
    principal:    { type: Number, required: true },
    dateTaken:    { type: Date, required: true },
    interestRate: { type: Number, default: null }, // annual %, optional — a purely informational rate, no amortization schedule generated from it

    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null },
    bankOrCashLabel: { type: String, default: '' },

    // Closed once fully repaid (or manually, if written off) — a status
    // flag only, doesn't gate anything; outstanding balance already
    // reads 0 once repayments cover the principal regardless of this.
    status: { type: String, enum: ['active', 'closed'], default: 'active' },

    notes: { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceLoan = mongoose.models.financeLoan || mongoose.model('financeLoan', financeLoanSchema);
export default FinanceLoan;
