import mongoose from 'mongoose';

// The Cash Book. Entries with one of the three relatedXId fields set were
// created automatically by a cash-mode receipt/contractor payment/vendor
// payment (see those controllers) — not manually re-editable through the
// Cash Book UI; edit the originating record instead. Manual entries
// (nothing set) are for cash with no originating record — petty cash,
// owner draws.
const financeCashEntrySchema = new mongoose.Schema({
    date:   { type: Date, required: true },
    type:   { type: String, enum: ['in', 'out'], required: true },
    amount: { type: Number, required: true },

    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },
    reason:    { type: String, required: true },

    relatedReceiptId:           { type: mongoose.Schema.Types.ObjectId, ref: 'financeReceipt', default: null },
    relatedContractorPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeContractorPayment', default: null },
    relatedVendorPaymentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendorPayment', default: null },

    notes: { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceCashEntry = mongoose.models.financeCashEntry || mongoose.model('financeCashEntry', financeCashEntrySchema);
export default FinanceCashEntry;
