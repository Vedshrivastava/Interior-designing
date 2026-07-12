import mongoose from 'mongoose';

// A team can have multiple rows for the same project — one per work type —
// so the unique key is (project, team, workType), not (project, team).
const financeTeamRateSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    teamId:    { type: mongoose.Schema.Types.ObjectId, ref: 'financeTeam', required: true },
    workType:  { type: String, required: true },

    paymentBasis: { type: String, enum: ['per_sqft', 'per_day'], required: true },
    ratePerSqft:  { type: Number, default: 0 },
    ratePerDay:   { type: Number, default: 0 },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

financeTeamRateSchema.index({ projectId: 1, teamId: 1, workType: 1 }, { unique: true });

const FinanceTeamRate = mongoose.models.financeTeamRate || mongoose.model('financeTeamRate', financeTeamRateSchema);
export default FinanceTeamRate;
