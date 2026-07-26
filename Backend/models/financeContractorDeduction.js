import mongoose from 'mongoose';

// A deduction against what a labour contractor is owed — e.g. reconciling
// sqft that got logged but never billed to the client because the engineer
// judged it faulty/incomplete. `amount` is always derived server-side from
// `areaSqft × that vendor's configured rate for this work's workType` (see
// controller) — never trust a client-sent amount for this model; sqft is
// the one thing a human actually judges ("whose mistake, how much of it"),
// the ₹ value is arithmetic from there.
const financeContractorDeductionSchema = new mongoose.Schema({
    vendorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },
    // Pins a deduction to the specific Work it was caught on — required in
    // practice (the controller needs it to look up a rate for areaSqft),
    // kept `default: null` at the schema level only so it doesn't reject
    // reading older rows saved before this field existed.
    workId:    { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', default: null },

    areaSqft: { type: Number, required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    date:   { type: Date, required: true },
    notes:  { type: String, default: '' },

    // Set only when this row was created as part of a Work's atomic
    // review-and-distribute flow (financeWorkReview.js's reviewWork) —
    // stamped with that Work's financeWorkReview.reviewCycle AT THE TIME
    // this deduction was saved, so attribution checks can tell "covers the
    // current rejection" apart from "leftover from an earlier, already-
    // superseded one." `null` for a deduction entered manually outside
    // that flow (a Ledger's own "+ Add Deduction") — those are standalone
    // corrections, never meant to satisfy the attribution gate.
    workReviewCycle: { type: Number, default: null },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceContractorDeduction = mongoose.models.financeContractorDeduction || mongoose.model('financeContractorDeduction', financeContractorDeductionSchema);
export default FinanceContractorDeduction;
