import mongoose from 'mongoose';

// Labour team roster — distinct from financeEmployee (salaried staff).
// Not explicitly named in the ERP roadmap's Phase 0 list, but financeTeamRate.teamId
// needs something to reference, so this fills that gap.
const financeTeamSchema = new mongoose.Schema({
    name:               { type: String, required: true },
    contractorVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', default: null },
    members:            { type: [String], default: [] },
    notes:              { type: String, default: '' },
    deleted:            { type: Boolean, default: false },
    deletedAt:          { type: Date },
    deletedBy:          { type: String },
}, { timestamps: true });

const FinanceTeam = mongoose.models.financeTeam || mongoose.model('financeTeam', financeTeamSchema);
export default FinanceTeam;
