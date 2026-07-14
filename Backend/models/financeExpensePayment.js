import mongoose from 'mongoose';

// Settles part (or all) of a financeExpense's accrued amount. Not every
// expense goes through this — one created with payment info already
// supplied is considered paid at entry (see controllers/financeExpense.js)
// and never gets one of these. This only exists for the accrual path: an
// expense logged with no payment info yet, settled later via one or more
// of these, same partial-payments-against-a-fixed-obligation shape as
// financeReceipt against a financeRunningBill.
const financeExpensePaymentSchema = new mongoose.Schema({
    expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeExpense', required: true },

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' },
    bankOrCashLabel: { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null }, // no bankAccountId means cash — see controllers/financeExpensePayment.js's cash-entry automation
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceExpensePayment = mongoose.models.financeExpensePayment || mongoose.model('financeExpensePayment', financeExpensePaymentSchema);
export default FinanceExpensePayment;
