import mongoose from 'mongoose';

// A vendor purchase or return. totalAmount is snapshotted at creation
// (quantity × ratePerUnit) — same reasoning as Running Bill line items:
// this is a real financial document, not something to recompute later if
// a rate changes elsewhere. Saving one auto-creates the matching
// financeStockMovement (dump for a purchase, return for a return) — see
// controllers/financePurchase.js.
const financePurchaseSchema = new mongoose.Schema({
    vendorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'financeVendor', required: true },
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeMaterial', required: true },

    quantity:     { type: Number, required: true },
    ratePerUnit:  { type: Number, required: true },
    totalAmount:  { type: Number, required: true },

    transactionType: { type: String, enum: ['purchase', 'return'], default: 'purchase' },
    date:             { type: Date, required: true },
    referenceNumber:  { type: String, default: '' }, // PO number for a purchase, return reference for a return
    notes:            { type: String, default: '' },

    // Optional — entered at purchase time, unset on every record from
    // before this field existed. Not part of totalAmount (which stays
    // quantity × ratePerUnit); this is a separate figure the CA Monthly
    // Package's Input GST sums independently.
    gstRate:   { type: Number, default: null },
    gstAmount: { type: Number, default: null },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinancePurchase = mongoose.models.financePurchase || mongoose.model('financePurchase', financePurchaseSchema);
export default FinancePurchase;
