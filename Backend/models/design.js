import mongoose from "mongoose";

const designSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    images: [{ type: String, required: true }],
    category: { type: String, required: true },
    subcategories: { type: [String], default: [] },
    points: [{ type: String }],
    
    // ⭐️ The perfect addition for your UI control
    isFeatured:  { type: Boolean, default: false },
    deleted:     { type: Boolean, default: false },
    deletedAt:   { type: Date },
    deletedBy:   { type: String },
}, { timestamps: true });

const design = mongoose.models.design || mongoose.model("design", designSchema);

export default design;