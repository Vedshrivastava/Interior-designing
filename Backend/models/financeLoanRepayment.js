import mongoose from 'mongoose';

// One repayment against a financeLoan. `amount` is the total handed
// over; `interestPortion` (optional, default 0) is however much of that
// was interest rather than principal reduction — the rest
// (amount − interestPortion) is what actually reduces the loan's
// outstanding balance. Same bank/cash convention as every payment type
// here: bankAccountId set → shows up in that account's own balance
// (financeBankAccount.js's getAccountActivity); not set → auto-creates a
// matching financeCashEntry (see controllers/financeLoan.js).
const financeLoanRepaymentSchema = new mongoose.Schema({
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeLoan', required: true },
    date:   { type: Date, required: true },

    amount:          { type: Number, required: true },
    interestPortion: { type: Number, default: 0 },

    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null },
    bankOrCashLabel: { type: String, default: '' },

    notes: { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

financeLoanRepaymentSchema.index({ loanId: 1, date: -1 });

const FinanceLoanRepayment = mongoose.models.financeLoanRepayment || mongoose.model('financeLoanRepayment', financeLoanRepaymentSchema);
export default FinanceLoanRepayment;
