import mongoose from 'mongoose';

const productSubcategorySchema = new mongoose.Schema({
    name:       { type: String, required: true, unique: true },
    icon:       { type: String, default: 'check' },   // Iconify icon ID
    color:      { type: String, default: '#c9a87c' },  // hex color
    categories: { type: [String], default: [] },        // parent product category names (multi)
    order:      { type: Number, default: 999 },
    deleted:    { type: Boolean, default: false },
    deletedAt:  { type: Date },
    deletedBy:  { type: String },
}, { timestamps: true });

const ProductSubcategory = mongoose.models.productSubcategory || mongoose.model('productSubcategory', productSubcategorySchema);
export default ProductSubcategory;
