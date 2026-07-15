import mongoose from 'mongoose';

// A file on record for a client (agreement, ID proof, etc.) — add-only,
// same as Team Rates: remove and re-upload rather than replacing a file
// in place, so there's never ambiguity about which version was on file
// when.
const financeClientDocumentSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeClient', required: true },
    name:     { type: String, required: true },
    fileUrl:  { type: String, required: true },
    notes:    { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceClientDocument = mongoose.models.financeClientDocument || mongoose.model('financeClientDocument', financeClientDocumentSchema);
export default FinanceClientDocument;
