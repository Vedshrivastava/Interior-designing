import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name:  { type: String, required: true, unique: true }, // e.g. "Kitchen Designs"
    slug:  { type: String, required: true, unique: true }, // e.g. "kitchen-designs"
    label: { type: String, required: true },               // e.g. "Kitchen"
    order:     { type: Number, default: 999 },
    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const Category = mongoose.models.category || mongoose.model('category', categorySchema);
export default Category;
