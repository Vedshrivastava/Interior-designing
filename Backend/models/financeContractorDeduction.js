import mongoose from 'mongoose';

// A deduction against what a labour contractor is owed — e.g. a labour
// expense the client paid directly instead of routing through us.
const financeContractorDeductionSchema = new mongoose.Schema({
    vendorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null },

    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    date:   { type: Date, required: true },
    notes:  { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceContractorDeduction = mongoose.models.financeContractorDeduction || mongoose.model('financeContractorDeduction', financeContractorDeductionSchema);
export default FinanceContractorDeduction;
