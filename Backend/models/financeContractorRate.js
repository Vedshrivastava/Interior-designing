import mongoose from 'mongoose';

// Replaces financeTeamRate — rate lives on the contractor vendor directly,
// not an intermediate "team" record. A contractor can run several crews
// under the hood, but they're paid at one rate per (project, workType);
// the Contractor Ledger already aggregated across crews of one vendor
// either way, so the crew-level split added no real capability.
//
// A vendor can have multiple rows for the same project — one per work
// type — so the unique key is (project, vendor, workType).
const financeContractorRateSchema = new mongoose.Schema({
    projectId:         { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    contractorVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', required: true },
    workType:          { type: String, required: true },

    ratePerSqft: { type: Number, required: true },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

// Partial index — see financeWorkTypeRate.js for why `deleted: false` (not $ne).
financeContractorRateSchema.index(
    { projectId: 1, contractorVendorId: 1, workType: 1 },
    { unique: true, partialFilterExpression: { deleted: false } }
);

const FinanceContractorRate = mongoose.models.financeContractorRate || mongoose.model('financeContractorRate', financeContractorRateSchema);
export default FinanceContractorRate;
