import mongoose from 'mongoose';

// Source of truth for "which labourers are on this Work, and under which
// supervisor" — mirrors financeWorkContractorAssignment, plus a
// supervisorId that's a fact about this specific assignment, not the
// labourer. A Work can have several rows sharing one supervisorId (one
// team) and/or several rows split across different supervisorIds (more
// than one team on the same Work) — both are normal. The same labourer
// can be assigned to many Works, each time with whichever supervisor is
// actually running that crew at that moment.
const financeWorkLabourAssignmentSchema = new mongoose.Schema({
    workId:       { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', required: true },
    labourerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeLabourer', required: true },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeEmployee', required: true },
    notes:        { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

// Partial index — see financeWorkTypeRate.js for why `deleted: false` (not $ne).
financeWorkLabourAssignmentSchema.index(
    { workId: 1, labourerId: 1 },
    { unique: true, partialFilterExpression: { deleted: false } }
);

const FinanceWorkLabourAssignment = mongoose.models.financeWorkLabourAssignment
    || mongoose.model('financeWorkLabourAssignment', financeWorkLabourAssignmentSchema);
export default FinanceWorkLabourAssignment;
