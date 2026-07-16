import mongoose from 'mongoose';

// Source of truth for "which labourers are on this Work" — mirrors
// financeWorkContractorAssignment. A Work can have many labourers (a whole
// crew, each individually tracked); a labourer can be on many Works.
const financeWorkLabourAssignmentSchema = new mongoose.Schema({
    workId:     { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', required: true },
    labourerId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeLabourer', required: true },
    notes:      { type: String, default: '' },

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
