import mongoose from 'mongoose';

// A day-to-day site log — plain notes and flagged issues on the same
// timeline. `status` only means anything for entryType: 'issue'; a note
// just carries a date and text, same append-only-log shape as
// financeExpense.
const financeSiteDiarySchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    date:      { type: Date, required: true },

    entryType: { type: String, enum: ['note', 'issue'], default: 'note' },
    status:    { type: String, enum: ['open', 'resolved'], default: 'open' },

    note:     { type: String, required: true },
    loggedBy: { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceSiteDiary = mongoose.models.financeSiteDiary || mongoose.model('financeSiteDiary', financeSiteDiarySchema);
export default FinanceSiteDiary;
