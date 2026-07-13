import mongoose from 'mongoose';

// A generated, historical bill document — unlike progress %, earnings, and
// current stock (all computed on read elsewhere in this codebase),
// totalAmount and every line item's rate/amount are snapshotted at
// generation time and never recalculated, even if the underlying
// financeWorkTypeRate changes afterward. This only applies to
// with_material / without_material projects — advance-contract projects
// keep using their own advanceAmount/advanceInvoiced/advanceReceived
// fields on financeProject and never get a financeRunningBill.
const financeRunningBillSchema = new mongoose.Schema({
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    billNumber: { type: String, required: true }, // sequential per project, assigned at generation

    billDate:   { type: Date, required: true },
    periodFrom: { type: Date },
    periodTo:   { type: Date },

    lineItems: [{
        workId:            { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', required: true },
        workType:           { type: String, required: true },
        areaBilledSqft:     { type: Number, required: true },
        clientRatePerSqft:  { type: Number, required: true }, // snapshotted from financeWorkTypeRate at generation
        amount:             { type: Number, required: true }, // snapshotted: areaBilledSqft * clientRatePerSqft
    }],

    totalAmount: { type: Number, required: true },

    // Optional — set at generation time if the owner enters a GST rate;
    // gstAmount is snapshotted then and frozen like every other amount on
    // this document. Unset on every bill generated before this field
    // existed, and on any bill generated without a rate. Grand total for
    // display purposes is totalAmount + (gstAmount || 0), computed at
    // render time rather than stored as its own field.
    gstRate:   { type: Number, default: null },
    gstAmount: { type: Number, default: null },

    // Payment status is derived from receipts against this bill elsewhere
    // (see receivables/summary) — status here is just draft-vs-issued,
    // not a payment state.
    status: { type: String, enum: ['draft', 'issued'], default: 'draft' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceRunningBill = mongoose.models.financeRunningBill || mongoose.model('financeRunningBill', financeRunningBillSchema);
export default FinanceRunningBill;
