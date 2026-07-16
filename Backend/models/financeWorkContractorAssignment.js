import mongoose from 'mongoose';

// Source of truth for "which contractor vendors are on this Work" —
// replaces financeWorkTeamAssignment (which pointed at an intermediate
// financeTeam record; that layer is gone, this points straight at the
// vendor). A Work can have several of these (more than one contractor
// splitting one scope of work); a vendor can be assigned to many Works.
const financeWorkContractorAssignmentSchema = new mongoose.Schema({
    workId:             { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', required: true },
    contractorVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', required: true },
    notes:              { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

// Partial index — see financeWorkTypeRate.js for why `deleted: false` (not $ne).
financeWorkContractorAssignmentSchema.index(
    { workId: 1, contractorVendorId: 1 },
    { unique: true, partialFilterExpression: { deleted: false } }
);

const FinanceWorkContractorAssignment = mongoose.models.financeWorkContractorAssignment
    || mongoose.model('financeWorkContractorAssignment', financeWorkContractorAssignmentSchema);
export default FinanceWorkContractorAssignment;
