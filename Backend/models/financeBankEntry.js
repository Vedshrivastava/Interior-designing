import mongoose from 'mongoose';

// Manual bank entries — the bank-account equivalent of financeCashEntry's
// "manual entries only" half (petty cash, owner draws), for money moving
// into/out of a bank account with no originating receipt/payment/transfer
// behind it: capital injected, a loan disbursed into the account, interest
// credited, or a correction against the real bank statement. Unlike
// financeCashEntry, this model is manual-only from the start — every
// receipt/contractor-payment/vendor-payment/etc already carries its own
// bankAccountId and feeds financeBankAccount.js's getAccountActivity
// directly, so there's no auto-generated case to also represent here.
const financeBankEntrySchema = new mongoose.Schema({
    date:   { type: Date, required: true },
    type:   { type: String, enum: ['in', 'out'], required: true },
    amount: { type: Number, required: true },
    // What kind of thing this money movement actually is — orthogonal to
    // type (direction). ownerInvestment/loan/interest describe the most
    // common reasons money enters an account with no receipt/payment
    // behind it; correction/other cover everything else (including any
    // out-direction entry, which never carries owner-investment semantics).
    // Defaults to 'other' so every entry recorded before this field
    // existed keeps working without a backfill.
    source: { type: String, enum: ['ownerInvestment', 'loan', 'interest', 'correction', 'other'], default: 'other' },

    bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', required: true },
    projectId:     { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },
    reason:        { type: String, required: true },
    notes:         { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceBankEntry = mongoose.models.financeBankEntry || mongoose.model('financeBankEntry', financeBankEntrySchema);
export default FinanceBankEntry;
