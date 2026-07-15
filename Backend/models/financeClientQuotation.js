import mongoose from 'mongoose';

// Pre-project price quotation issued to a client — no project may exist yet
// at this point, so this is intentionally not tied to financeProject.
// Accepting one does NOT auto-create a Project (kept as a standalone
// record); the actual Project still gets created through New Project once
// work is confirmed.
const financeClientQuotationSchema = new mongoose.Schema({
    clientId:        { type: mongoose.Schema.Types.ObjectId, ref: 'financeClient', required: true },
    quotationNumber: { type: String, required: true }, // sequential per client, assigned on add
    date:            { type: Date, required: true },
    amount:          { type: Number, required: true },
    validUntil:      { type: Date, default: null },
    status:          { type: String, enum: ['pending', 'accepted', 'rejected', 'expired'], default: 'pending' },
    notes:           { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceClientQuotation = mongoose.models.financeClientQuotation || mongoose.model('financeClientQuotation', financeClientQuotationSchema);
export default FinanceClientQuotation;
