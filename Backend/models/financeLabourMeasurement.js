import mongoose from 'mongoose';

// One daily measurement entry against a financeWork, for one individual
// labourer — mirrors financeMeasurement's shape but scoped per person
// instead of per contractor vendor. Deliberately a separate model rather
// than adding labourerId onto financeMeasurement: keeps the just-verified
// Contractor pipeline untouched, and the two attribution types (vendor vs.
// individual) never need to be filtered apart from one another.
//
// No engineerApproved gate here, unlike financeMeasurement — a labourer's
// earnings count every measured sqft as soon as it's logged. Correction
// happens after the fact, via financeLabourDeduction (a periodic engineer
// review) or financeSupervisorDeduction/financeSupervisorIncentive (a
// supervisor catching and fixing bad work on the spot), not by excluding
// area from this record.
const financeLabourMeasurementSchema = new mongoose.Schema({
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    workId:     { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', required: true },
    labourerId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeLabourer', required: true },

    date:            { type: Date, required: true },
    areaCoveredSqft: { type: Number, required: true },
    supervisorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'financeEmployee', default: null }, // who recorded this

    // Same shape and same materialTrackingEnabled gate as financeMeasurement's
    // own materialUsed — a labourer's work consumes material exactly like a
    // contractor's does, and needs to flow into the same stock/cost pipeline
    // (see controllers/financeLabourMeasurement.js).
    materialUsed: [{
        materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeMaterial', required: true },
        quantity:   { type: Number, required: true },
    }],

    remarks:         { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceLabourMeasurement = mongoose.models.financeLabourMeasurement
    || mongoose.model('financeLabourMeasurement', financeLabourMeasurementSchema);
export default FinanceLabourMeasurement;
