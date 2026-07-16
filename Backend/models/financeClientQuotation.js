import mongoose from 'mongoose';

// Price quotation issued against a Project — the studio always creates the
// Project first (client → project → quote → work order/signed rate once
// accepted), so unlike an earlier draft of this model, there's no
// pre-project use case to support. Sequential numbering, status lifecycle,
// and read/write access all key off projectId; a client's own Quotations
// view (ClientDetail.jsx) is a read-only rollup across that client's
// projects, not its own source of truth.
const financeClientQuotationSchema = new mongoose.Schema({
    projectId:       { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    quotationNumber: { type: String, required: true }, // sequential per project, assigned on add
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
