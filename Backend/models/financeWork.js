import mongoose from 'mongoose';

// A work item under a project — e.g. "ABC Mall → Putty". `workType` is the
// same free-text value already used in financeWorkTypeRate/financeTeamRate,
// so client/referral/team rates resolve by looking up (projectId, workType)
// / (projectId, teamId, workType) rather than duplicating rate fields here.
const financeWorkSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    workType:  { type: String, required: true },
    teamId:    { type: mongoose.Schema.Types.ObjectId, ref: 'financeTeam', required: true },

    workOrderNumber:    { type: String, default: '' },
    startDate:          { type: Date },
    estimatedAreaSqft:  { type: Number, required: true },

    // Running total — only ever updated by the measurement-save automation
    // (see controllers/financeMeasurement.js). Never accepted from the
    // update endpoint directly.
    completedAreaSqft:  { type: Number, default: 0 },

    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    notes:  { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceWork = mongoose.models.financeWork || mongoose.model('financeWork', financeWorkSchema);
export default FinanceWork;
