import mongoose from 'mongoose';

// Money given to a labour contractor (financeVendor with vendorType
// 'labour_contractor') ahead of settlement — scoped to the contractor
// company, not the individual team, since money settles with the
// contractor even though work is tracked per team.
const financeContractorAdvanceSchema = new mongoose.Schema({
    vendorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null }, // not every advance is tied to one project

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' }, // reuses financeSetting's payment_mode values
    bankOrCashLabel: { type: String, default: '' },
    utrNumber:       { type: String, default: '' },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceContractorAdvance = mongoose.models.financeContractorAdvance || mongoose.model('financeContractorAdvance', financeContractorAdvanceSchema);
export default FinanceContractorAdvance;
