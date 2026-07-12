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

// Partial index — only enforced among non-deleted rows, so removing a rate
// doesn't permanently block re-adding the same work type later.
// (Mongo partial-index filters don't support $ne, so this relies on
// `deleted` always being the literal boolean `false` on active rows —
// true via the schema default, since it's never left undefined.)
financeWorkTypeRateSchema.index(
    { projectId: 1, workType: 1 },
    { unique: true, partialFilterExpression: { deleted: false } }
);

const FinanceWorkTypeRate = mongoose.models.financeWorkTypeRate || mongoose.model('financeWorkTypeRate', financeWorkTypeRateSchema);
export default FinanceWorkTypeRate;
