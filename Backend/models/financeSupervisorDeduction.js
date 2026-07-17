import mongoose from 'mongoose';

// Debit-side sibling of financeSupervisorIncentive — a manual cut against
// a supervisor's salary, entered when an engineer's periodic review finds
// the supervisor jointly accountable for a flaw (alongside whichever
// labourer(s) actually did the work; that side is a separate
// financeLabourDeduction row). Same "no computed metric, manual amount +
// note" shape as the incentive it mirrors.
const financeSupervisorDeductionSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeEmployee', required: true },
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },
    // Optional — same idea as financeContractorDeduction.workId /
    // financeLabourDeduction.workId: pins a deduction to the specific Work
    // it was caught on, so it can surface next to that Work's own
    // measurements/progress instead of only ever being a running total
    // against the employee.
    workId:     { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', default: null },

    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    date:   { type: Date, required: true },
    notes:  { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceSupervisorDeduction = mongoose.models.financeSupervisorDeduction || mongoose.model('financeSupervisorDeduction', financeSupervisorDeductionSchema);
export default FinanceSupervisorDeduction;
