import mongoose from 'mongoose';

const productCategorySchema = new mongoose.Schema({
    name:      { type: String, required: true, unique: true },
    icon:      { type: String, default: 'check' },  // Iconify icon ID e.g. 'mdi:sofa'
    color:     { type: String, default: '#c9a87c' }, // hex color
    order:     { type: Number, default: 999 },
    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const ProductCategory = mongoose.models.productCategory || mongoose.model('productCategory', productCategorySchema);
export default ProductCategory;
