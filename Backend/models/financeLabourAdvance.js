import mongoose from 'mongoose';

// Money given to a labourer at the site ahead of settlement — mirrors
// financeContractorAdvance, at individual-labourer granularity since each
// labourer is now paid directly, not through a supervisor/contractor.
const financeLabourAdvanceSchema = new mongoose.Schema({
    labourerId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeLabourer', required: true },
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', default: null }, // not every advance is tied to one project

    amount: { type: Number, required: true },
    date:   { type: Date, required: true },

    paymentMode:     { type: String, default: '' }, // reuses financeSetting's payment_mode values
    bankOrCashLabel: { type: String, default: '' },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceLabourAdvance = mongoose.models.financeLabourAdvance || mongoose.model('financeLabourAdvance', financeLabourAdvanceSchema);
export default FinanceLabourAdvance;
