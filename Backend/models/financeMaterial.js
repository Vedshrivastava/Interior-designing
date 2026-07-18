import mongoose from 'mongoose';

const financeMaterialSchema = new mongoose.Schema({
    name:              { type: String, required: true, unique: true },
    unit:              { type: String, default: 'unit' }, // e.g. bag, sqft, kg, piece
    minimumStockLevel: { type: Number, default: 0 },
    notes:             { type: String, default: '' },

    // Which financeWork.workType values this material applies to (matched
    // by string, same as every other workType usage in this codebase —
    // see financeWorkTypeRate). Empty = usable for every work type
    // (cement, sand, etc.) — only restricted when explicitly tagged.
    workTypes:         { type: [String], default: [] },

    // Set by the low-stock alert check (controllers/financeCompanySettings.js)
    // when an email actually goes out — read back on the next check to
    // avoid re-notifying within 24 hours. Never set anywhere else.
    lastNotifiedAt: { type: Date, default: null },

    deleted:           { type: Boolean, default: false },
    deletedAt:         { type: Date },
    deletedBy:         { type: String },
}, { timestamps: true });

const FinanceMaterial = mongoose.models.financeMaterial || mongoose.model('financeMaterial', financeMaterialSchema);
export default FinanceMaterial;
