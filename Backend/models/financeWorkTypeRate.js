import mongoose from 'mongoose';

const financeWorkTypeRateSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    workType:  { type: String, required: true },

    clientRatePerSqft:   { type: Number, required: true },
    referralRatePerSqft: { type: Number, default: 0 },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

financeWorkTypeRateSchema.index({ projectId: 1, workType: 1 }, { unique: true });

const FinanceWorkTypeRate = mongoose.models.financeWorkTypeRate || mongoose.model('financeWorkTypeRate', financeWorkTypeRateSchema);
export default FinanceWorkTypeRate;
