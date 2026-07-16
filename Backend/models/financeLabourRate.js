import mongoose from 'mongoose';

// Mirrors financeContractorRate, at individual-labourer granularity. A
// labourer is hired directly by the company (no intermediate vendor/team),
// paid per sqft, and can rate differently across work types — e.g. Tiles
// pays more per sqft than Putty for the same person.
const financeLabourRateSchema = new mongoose.Schema({
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    labourerId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeLabourer', required: true },
    workType:   { type: String, required: true },

    ratePerSqft: { type: Number, required: true },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

// Partial index — see financeWorkTypeRate.js for why `deleted: false` (not $ne).
financeLabourRateSchema.index(
    { projectId: 1, labourerId: 1, workType: 1 },
    { unique: true, partialFilterExpression: { deleted: false } }
);

const FinanceLabourRate = mongoose.models.financeLabourRate || mongoose.model('financeLabourRate', financeLabourRateSchema);
export default FinanceLabourRate;
