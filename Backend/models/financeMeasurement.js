import mongoose from 'mongoose';

// One daily measurement entry against a financeWork. Saving one is the
// trigger for the whole Site Operations / Site Inventory automation — see
// controllers/financeMeasurement.js.
const financeMeasurementSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    workId:    { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', required: true },

    // Which team did this day's measured area — required for new entries so
    // earnings can attribute per-team when a Work has more than one crew.
    // Old measurements predate this field and fall back to the Work's
    // legacy teamId when read (see utils/workTeamAssignments.js).
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeTeam', default: null },

    date:            { type: Date, required: true },
    supervisorName:  { type: String, default: '' }, // plain text — mirrors financeProject.assignedSupervisor; no Supervisor model yet
    areaCoveredSqft: { type: Number, required: true },

    // Only relevant/shown in the UI when financeProject.materialTrackingEnabled
    // is true for this project.
    materialUsed: [{
        materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeMaterial', required: true },
        quantity:   { type: Number, required: true },
    }],

    photos:  { type: [String], default: [] }, // Cloudinary URLs, same upload pattern as design/product images
    remarks: { type: String, default: '' },

    // Approval gates two things: whether this area is billable to the
    // client (financeRunningBill) and whether it's payable to the
    // contractor team that did it (financeContractorLedger) — one signal,
    // both consequences. Only ever toggled by whoever reviews the site
    // (the engineer), tracked here for accountability, not enforced by a
    // role check — there's no sub-role system in this app yet.
    engineerApproved:   { type: Boolean, default: false },
    engineerApprovedAt: { type: Date },
    engineerApprovedBy: { type: String, default: '' },

    // Set by the running-bill generation automation when this measurement
    // gets included in a bill — prevents billing the same measurement twice.
    billedInRunningBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeRunningBill', default: null },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceMeasurement = mongoose.models.financeMeasurement || mongoose.model('financeMeasurement', financeMeasurementSchema);
export default FinanceMeasurement;
