import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name:          { type: String, required: true },
    description:   { type: String, required: true },
    images:        [{ type: String, required: true }],
    categories:    [{ type: String }],
    subcategory:   { type: String },               // legacy single (kept for old data)
    subcategories: { type: [String], default: [] }, // multi-select
    material:      { type: String },              // legacy single (kept for old data)
    materials:     { type: [String], default: [] }, // multi-select
    finish:        { type: String },              // legacy single (kept for old data)
    finishes:      { type: [String], default: [] }, // multi-select
    specialities:  [{ type: String }],
    applications:  [{ type: String }],
    points:        [{ type: String }],
    isFeatured:    { type: Boolean, default: false },
    deleted:       { type: Boolean, default: false },
    deletedAt:     { type: Date },
    deletedBy:     { type: String },
}, {
    timestamps: true,
});

const Product = mongoose.models.product || mongoose.model("product", productSchema);

export default Product;
