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
        // Per work type, not per bill — a bill mixing e.g. a material-rate
        // work type (5%) and a labour/service-rate one (18%) needs each
        // line taxed at its own rate, not one flat number across the whole
        // bill (see financeWorkTypeRate.gstRatePercent / generateRunningBill's
        // resolution order). Snapshotted here just like clientRatePerSqft.
        gstRatePercent:     { type: Number, default: null },
        gstAmount:          { type: Number, default: null }, // amount * gstRatePercent / 100
    }],

    totalAmount: { type: Number, required: true },

    // gstAmount here is the SUM of every line item's own gstAmount above —
    // still the one number everything company-wide (CA Monthly Package's
    // Output GST, etc.) sums across bills, unaffected by how many different
    // rates contributed to it. gstRate is now a blended/effective rate for
    // display only (gstAmount / totalAmount * 100) — meaningless as an
    // actual rate to reapply anywhere once more than one distinct rate is
    // present; use lineItems[].gstRatePercent for the real breakdown.
    // Both null on every bill generated before per-work-type GST existed,
    // and on any bill generated with nothing taxable.
    gstRate:   { type: Number, default: null },
    gstAmount: { type: Number, default: null },

    // Set by the overdue-receivable alert check
    // (controllers/financeCompanySettings.js) when an email actually goes
    // out for this bill — read back on the next check to avoid
    // re-notifying within 24 hours. Never set anywhere else.
    lastNotifiedAt: { type: Date, default: null },

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
