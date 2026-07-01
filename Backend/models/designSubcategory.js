import mongoose from 'mongoose';

const designSubcategorySchema = new mongoose.Schema({
    name:       { type: String, required: true, unique: true },
    icon:       { type: String, default: 'check' },   // Iconify icon ID
    color:      { type: String, default: '#c9a87c' },  // hex color
    categories: { type: [String], default: [] },        // parent design category names (multi)
    order:      { type: Number, default: 999 },
    deleted:    { type: Boolean, default: false },
    deletedAt:  { type: Date },
    deletedBy:  { type: String },
}, { timestamps: true });

const DesignSubcategory = mongoose.models.designSubcategory || mongoose.model('designSubcategory', designSubcategorySchema);
export default DesignSubcategory;
