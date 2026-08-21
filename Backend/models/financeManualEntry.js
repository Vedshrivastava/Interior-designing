import mongoose from 'mongoose';

// A hand-written daily record for a project too fragmented into small
// tasks to be worth formalizing as individual Works with their own rates
// (e.g. a plumbing project with hundreds of small jobs) — one row covers
// what was done, who got paid how much, and what to charge the client
// for it, all in free text/plain numbers, no Work/rate/measurement
// behind any of it. Both amounts are optional (a row can be pure cost,
// pure client billing, or both) but at least one must be nonzero — see
// addManualEntry's validation.
//
// reviewStatus mirrors the formal Work Review Panel's approve/reject
// gate — an entry only counts toward Profit/Revenue/Payables once
// approved (see computeProjectProfit's manual-entry blending), same
// "logged isn't the same as confirmed" principle as sqft-based review,
// just per-row (a discrete dated record) instead of a running ceiling
// against one Work (financeWorkReview.js's model, built for measurements
// that accumulate over time — these don't). Editing an approved/rejected
// entry's amounts resets it back to 'pending' (see updateManualEntry) —
// same "changed since it was reviewed, needs another look" rule the
// formal system enforces by recomputing against current logged sqft on
// every review.
//
// paymentStatus is a separate, purely cash-flow flag — has the worker
// actually been handed the money yet — independent of review; an entry
// can be approved (counted in cost) and still outstanding (not yet
// disbursed), same distinction the formal Contractor/Labour Ledger
// already draws between "approved cost" and "balance payable."
const financeManualEntrySchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    date:      { type: Date, required: true },

    workDescription: { type: String, required: true },

    partyName: { type: String, default: '' },
    partyType: { type: String, enum: ['contractor', 'labour', 'vendor', 'other'], default: 'other' },

    amountPaid:     { type: Number, default: 0 },
    paymentStatus:  { type: String, enum: ['outstanding', 'paid'], default: 'outstanding' },
    paidAt:         { type: Date, default: null },

    amountChargedToClient: { type: Number, default: 0 },

    reviewStatus:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedAt:       { type: Date, default: null },
    reviewedBy:       { type: String, default: '' },
    rejectionReason:  { type: String, default: '' },

    notes: { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

financeManualEntrySchema.index({ projectId: 1, date: -1 });

const FinanceManualEntry = mongoose.models.financeManualEntry || mongoose.model('financeManualEntry', financeManualEntrySchema);
export default FinanceManualEntry;
