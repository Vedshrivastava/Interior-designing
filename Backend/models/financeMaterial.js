import mongoose from 'mongoose';

const financeMaterialSchema = new mongoose.Schema({
    name:              { type: String, required: true, unique: true },
    unit:              { type: String, default: 'unit' }, // e.g. bag, sqft, kg, piece
    minimumStockLevel: { type: Number, default: 0 },
    notes:             { type: String, default: '' },
    deleted:           { type: Boolean, default: false },
    deletedAt:         { type: Date },
    deletedBy:         { type: String },
}, { timestamps: true });

const FinanceMaterial = mongoose.models.financeMaterial || mongoose.model('financeMaterial', financeMaterialSchema);
export default FinanceMaterial;
