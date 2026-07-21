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

    // assignedSupervisor (plain string) predates the Supervisors module —
    // kept as-is so old projects keep working untouched. New/edited
    // projects populate assignedSupervisorId instead (a Supervisor is a
    // financeEmployee, not a separate entity); the UI falls back to the
    // string when the ref isn't set.
    assignedSupervisor:       { type: String, default: '' },
    assignedSupervisorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'financeEmployee', default: null },
    labourContractorVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', default: null },
    // Optional for every contract type, including Advance — for With/Without
    // Material, commission is computedAreaSqft × financeWorkTypeRate.
    // referralRatePerSqft (see computeProjectCommissionCost); for Advance,
    // there's no per-sqft commission math at all — see referralCommissionAmount.
    // References financeReferral, not financeVendor — a referral isn't
    // someone the studio purchases anything from.
    referralId:               { type: mongoose.Schema.Types.ObjectId, ref: 'financeReferral', default: null },

    // Material Received/Issue logs available for this project — always true
    // for with_material, always false for without_material, owner's choice
    // for advance (some advance clients still get material supplied).
    materialTrackingEnabled: { type: Boolean, default: true },

    // Advance-only fields
    totalEstimatedCost:  { type: Number, default: 0 }, // optional context, doesn't drive anything
    advanceAmount:       { type: Number, default: 0 }, // manually entered, not computed from a percentage

    // Advance-only, and only meaningful when referralId is set — a
    // single manually-typed lump sum instead of the sqft × rate computation
    // With/Without Material projects use (an Advance deal's referral fee is
    // negotiated as a flat amount, not per square foot). Editable any time
    // after being set (computeProjectCommissionCost always reads the current
    // value fresh, so Profit/Client Profit/etc. move immediately when this
    // changes) — and re-confirmed once more specifically when the project is
    // marked Completed (see completeFinanceProject), since it's the last
    // real chance to get it right.
    referralCommissionAmount: { type: Number, default: 0 },

    // Advance-only — Step 5 of the wizard. Lightweight tracking until Phase 3
    // (Invoices/Payments) exists; will be replaced by a real invoice+payment
    // link once that phase is built.
    advanceInvoiced:       { type: Boolean, default: false },
    advanceInvoicedAt:     { type: Date },
    advanceReceived:       { type: Boolean, default: false },
    advanceReceivedAt:     { type: Date },
    advanceReceivedNotes:  { type: String, default: '' },

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
