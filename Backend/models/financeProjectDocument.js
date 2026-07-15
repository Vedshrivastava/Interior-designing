import mongoose from 'mongoose';

// A file on record for a project (work order, site approval, floor plan,
// etc.) — add-only, same as financeClientDocument: remove and re-upload
// rather than replacing a file in place, so there's never ambiguity about
// which version was on file when.
const financeProjectDocumentSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    name:      { type: String, required: true },
    fileUrl:   { type: String, required: true },
    notes:     { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceProjectDocument = mongoose.models.financeProjectDocument || mongoose.model('financeProjectDocument', financeProjectDocumentSchema);
export default FinanceProjectDocument;
