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
