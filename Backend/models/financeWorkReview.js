import mongoose from 'mongoose';

// The reviewed ceiling for one Work — a running total, not an
// append-only ledger. This is what "Approved" now means everywhere in
// Finance (Generate Bill's billable ceiling, and — via proportional
// splitting, same as before this feature — each contributing worker's own
// Approved Earnings): sqft that's actually been looked at and confirmed,
// not merely sqft that's been logged.
//
// Deliberately work-level, not per-worker: reviewing here only answers
// "how much of this Work is genuinely done well," a single number a site
// engineer can judge directly. WHO specifically is responsible for the
// rejected portion is a separate decision, made later in Payables — see
// that flow's own deduction endpoints (financeContractorDeduction/
// financeLabourDeduction/financeSupervisorDeduction), which already
// existed before this feature and already reduce a specific worker's own
// Balance Payable. This model only tracks the work-level total; how much
// of the rejected portion has been allocated so far is computed fresh
// from those deduction records, never stored redundantly here.
//
// The review action (see controllers/financeWorkReview.js) recomputes
// against the Work's *current* total logged sqft, so new measurements
// added after a review correctly fall back to "pending review" until
// reviewed again — approvedAreaSqft only ever moves via an explicit
// review action, never silently drifts with new logging.
const financeWorkReviewSchema = new mongoose.Schema({
    workId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', required: true, unique: true },

    approvedAreaSqft: { type: Number, required: true, default: 0 },
    // The rejected pool — set fresh each review (logged − approved at
    // review time), not cumulative across reviews. How much of this has
    // been allocated to specific people in Payables is deliberately NOT
    // stored here — it's computed fresh by summing the actual
    // financeContractorDeduction/financeLabourDeduction/
    // financeSupervisorDeduction records tied to this workId, same
    // anti-drift rule as everywhere else in this codebase (never a second
    // copy of a number something else already owns).
    rejectedAreaSqft: { type: Number, required: true, default: 0 },

    lastReviewedAt: { type: Date },
    lastReviewedBy: { type: String },
}, { timestamps: true });

const FinanceWorkReview = mongoose.models.financeWorkReview || mongoose.model('financeWorkReview', financeWorkReviewSchema);
export default FinanceWorkReview;
