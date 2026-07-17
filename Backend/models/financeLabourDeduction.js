import mongoose from 'mongoose';

// A deduction against what a labourer is owed. Two distinct real-world
// triggers share this one shape (a manual amount + note, never an
// auto-computed area exclusion):
//   - 'supervisor_catch': the supervisor personally caught bad work and
//     fixed it themselves before it ever reached engineer review — this
//     amount is also credited to the supervisor as an incentive (see
//     financeSupervisorIncentive; the two are entered as one linked action
//     by the frontend, not enforced as a pair here).
//   - 'engineer_review': the engineer periodically (not on a fixed
//     schedule) reviews accumulated work as a whole and flags a flaw —
//     amount and who's responsible are typed in manually since there's no
//     per-measurement approval gate to derive it from.
const financeLabourDeductionSchema = new mongoose.Schema({
    labourerId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeLabourer', required: true },
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },
    // Optional — same idea as financeContractorDeduction.workId: pins an
    // 'engineer_review' negligence deduction to the specific Work it was
    // caught on, so it can surface next to that Work's own measurements.
    workId:     { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', default: null },

    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    date:   { type: Date, required: true },
    source: { type: String, enum: ['supervisor_catch', 'engineer_review'], required: true },

    // Only set (and required) when source is 'supervisor_catch' — the
    // supervisor who caught and fixed the work, credited this same amount
    // as an incentive (see controller: creates a matching
    // financeSupervisorIncentive row alongside this deduction). An
    // 'engineer_review' deduction never auto-credits anyone; if the
    // supervisor is also accountable, that's a separate, independently
    // entered financeSupervisorDeduction.
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeEmployee', default: null },

    notes: { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceLabourDeduction = mongoose.models.financeLabourDeduction || mongoose.model('financeLabourDeduction', financeLabourDeductionSchema);
export default FinanceLabourDeduction;
