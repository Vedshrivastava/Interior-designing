import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
    name:      { type: String, required: true, unique: true },
    icon:      { type: String, default: 'check' },  // Iconify icon ID e.g. 'mdi:wood'
    color:     { type: String, default: '#c9a87c' }, // hex color
    order:     { type: Number, default: 999 },
    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const Material = mongoose.models.material || mongoose.model('material', materialSchema);
export default Material;
