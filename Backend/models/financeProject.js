import mongoose from 'mongoose';

// Contract/billing project — distinct from the public-site portfolio `project`
// model (showcase gallery). Full creation wizard is Phase 0.5; this is the
// Phase 0 schema only, per the roadmap's three contract-type branches.
const financeProjectSchema = new mongoose.Schema({
    name:           { type: String, required: true },
    clientId:       { type: mongoose.Schema.Types.ObjectId, ref: 'financeClient', required: true },
    siteLocation:   { type: String, default: '' },
    startDate:      { type: Date },
    estimatedAreaSqft: { type: Number, default: 0 },
    notes:          { type: String, default: '' },

    contractType: {
        type: String,
        enum: ['with_material', 'without_material', 'advance'],
        required: true,
    },

    assignedSupervisor:       { type: String, default: '' },
    labourContractorVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', default: null },
    referralVendorId:         { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', default: null }, // null for advance

    // Advance-only fields
    totalEstimatedCost:  { type: Number, default: 0 },
    contractPercentage:  { type: Number, default: 0 },
    advanceAmount:       { type: Number, default: 0 }, // computed: cost × percentage

    status: {
        type: String,
        enum: ['draft', 'active', 'completed'],
        default: 'draft', // stays draft until rates + team assignment are configured (Phase 0.5 guardrail)
    },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceProject = mongoose.models.financeProject || mongoose.model('financeProject', financeProjectSchema);
export default FinanceProject;
