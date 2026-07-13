import mongoose from 'mongoose';

// General company/site expense — not tied to a vendor, contractor, or
// employee. A straightforward paid-when-entered log, unlike the other
// payables here: no earned-vs-paid ledger, no computed balance.
const financeExpenseSchema = new mongoose.Schema({
    expenseCategory: { type: String, default: '' }, // reuses financeSetting's expense_category values
    projectId:       { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null }, // some expenses are project-specific, some are general overhead

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null }, // no bankAccountId means cash — see controllers/financeExpense.js's cash-entry automation
    bankOrCashLabel: { type: String, default: '' },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceExpense = mongoose.models.financeExpense || mongoose.model('financeExpense', financeExpenseSchema);
export default FinanceExpense;
