import mongoose from 'mongoose';

// Contractor crew — a team of workers billed via a labour_contractor vendor's
// rate card (financeTeamRate), distinct from financeEmployee (salaried staff)
// and financeLabourer (a supervisor's day-wage roster).
const financeTeamSchema = new mongoose.Schema({
    name:               { type: String, required: true },
    contractorVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', default: null },
    notes:              { type: String, default: '' },
    deleted:            { type: Boolean, default: false },
    deletedAt:          { type: Date },
    deletedBy:          { type: String },
}, { timestamps: true });

const FinanceTeam = mongoose.models.financeTeam || mongoose.model('financeTeam', financeTeamSchema);
export default FinanceTeam;
