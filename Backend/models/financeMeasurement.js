import mongoose from 'mongoose';

// One daily measurement entry against a financeWork. Saving one is the
// trigger for the whole Site Operations / Site Inventory automation — see
// controllers/financeMeasurement.js.
const financeMeasurementSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    workId:    { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', required: true },

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

    engineerApproved:   { type: Boolean, default: false },
    engineerApprovedAt: { type: Date },

    // Set by the running-bill generation automation when this measurement
    // gets included in a bill — prevents billing the same measurement twice.
    billedInRunningBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeRunningBill', default: null },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceMeasurement = mongoose.models.financeMeasurement || mongoose.model('financeMeasurement', financeMeasurementSchema);
export default FinanceMeasurement;
