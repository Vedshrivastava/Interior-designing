import mongoose from 'mongoose';

// A discretionary incentive payout to a supervisor (a financeEmployee) —
// distinct from their regular salary (financeSalaryPayment). No stored
// "approved area supervised" metric exists to compute this automatically
// (see Reports' Supervisor Analysis, still a placeholder for the same
// reason), so amount/reason are entered manually per payout.
const financeSupervisorIncentiveSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeEmployee', required: true },
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },
    // Optional — same idea as the workId already added to
    // financeContractorDeduction/financeLabourDeduction/
    // financeSupervisorDeduction this session: pins an incentive to the
    // specific Work it was earned on. Supervisors don't measure area, so
    // this is the closest thing to "approved amount" they get — presence
    // of an incentive tied to a work, not a computed figure.
    workId:     { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', default: null },

    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' },
    bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeBankAccount', default: null }, // no bankAccountId means cash — see controller's cash-entry automation
    bankOrCashLabel: { type: String, default: '' },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceSupervisorIncentive = mongoose.models.financeSupervisorIncentive || mongoose.model('financeSupervisorIncentive', financeSupervisorIncentiveSchema);
export default FinanceSupervisorIncentive;
