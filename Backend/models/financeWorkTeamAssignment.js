import mongoose from 'mongoose';

// Source of truth for "which teams are on this Work" — replaces
// financeWork.teamId (kept in that schema only for pre-migration records).
// A Work can have several of these (multiple crews splitting one scope of
// work); a Team can be assigned to many Works, same as before.
const financeWorkTeamAssignmentSchema = new mongoose.Schema({
    workId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeTeam', required: true },
    notes:  { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

// Partial index — see financeWorkTypeRate.js for why `deleted: false` (not $ne).
financeWorkTeamAssignmentSchema.index(
    { workId: 1, teamId: 1 },
    { unique: true, partialFilterExpression: { deleted: false } }
);

const FinanceWorkTeamAssignment = mongoose.models.financeWorkTeamAssignment
    || mongoose.model('financeWorkTeamAssignment', financeWorkTeamAssignmentSchema);
export default FinanceWorkTeamAssignment;
