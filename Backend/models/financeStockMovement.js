import mongoose from 'mongoose';

// Site Inventory ledger — inventory is tracked per project (site), not
// globally. Current stock is never stored; it's always computed on read as
// SUM(dump) − SUM(consume) − SUM(return) − SUM(waste), grouped by
// (projectId, materialId) — see controllers/financeStockMovement.js.
const financeStockMovementSchema = new mongoose.Schema({
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'financeProject', required: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeMaterial', required: true },

    movementType: { type: String, enum: ['dump', 'consume', 'return', 'waste'], required: true },
    quantity:     { type: Number, required: true },
    date:         { type: Date, required: true },

    // Set automatically by the measurement-save automation on `consume`
    // movements it creates — never set by the manual entry form.
    relatedMeasurementId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeMeasurement', default: null },

    // Auto-set on `consume` movements (from the measurement's own workId).
    // Manually pickable on `waste` entries going forward so waste can be
    // attributed to a specific work — dump/return stay project-level only.
    // Existing rows predate this field and stay null; Work Detail reports
    // those separately as project-level-only waste rather than hiding them.
    workId: { type: mongoose.Schema.Types.ObjectId, ref: 'financeWork', default: null },

    // Set automatically by the Procurement purchase/return automation on
    // the `dump`/`return` movements it creates — never set by the manual
    // entry form. dump/return can still ALSO be entered manually (opening
    // stock, ad-hoc site returns not tied to a formal purchase); only
    // `consume` and purchase/return-linked movements are automation-only.
    relatedPurchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'financePurchase', default: null },

    notes: { type: String, default: '' },

    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const FinanceStockMovement = mongoose.models.financeStockMovement || mongoose.model('financeStockMovement', financeStockMovementSchema);
export default FinanceStockMovement;
