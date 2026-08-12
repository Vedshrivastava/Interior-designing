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

    // The material cost this vendor's own rejected areaSqft wasted — set
    // only for atomic-review-flow rows (see workReviewCycle below), priced
    // at this vendor's own material-cost-per-sqft on this Work (falls back
    // to the Work's overall rate if they never logged material usage
    // themselves). Unlike `amount` (the labour-rate value, already fully
    // reflected via reduced Approved Earnings — see
    // getCategoryApprovedAreaByWorkId's own comment), this is a genuinely
    // NEW deduction: nothing else already accounts for it, so every reader
    // of deductionsTotal must always include it, regardless of
    // workReviewCycle. Also reclassified into the project's Material Waste
    // Cost (see computeProjectMaterialWasteReclassified) — net zero effect
    // on Profit from the reclassification itself, since it's removed from
    // plain Material Cost at the same time.
    materialWasteAmount: { type: Number, default: 0 },

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

financeContractorDeductionSchema.index({ vendorId: 1, projectId: 1 });
financeContractorDeductionSchema.index({ workId: 1 });

const FinanceContractorDeduction = mongoose.models.financeContractorDeduction || mongoose.model('financeContractorDeduction', financeContractorDeductionSchema);
export default FinanceContractorDeduction;
