import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name:          { type: String, required: true },
    description:   { type: String, required: true },
    images:        [{ type: String, required: true }],
    category:      {
        type: String,
        enum: ['Interior', 'Exterior', 'Functional Architecture'],
        required: true,
    },
    subcategory:   { type: String, required: true },
    material:      { type: String },
    finish:        { type: String },
    specialities:  [{ type: String }],
    applications:  [{ type: String }],
    points:        [{ type: String }],
    isFeatured:    { type: Boolean, default: false },
}, {
    timestamps: true,
});

const Product = mongoose.models.product || mongoose.model("product", productSchema);

export default Product;
