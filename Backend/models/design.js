import mongoose from "mongoose";

const designSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    images: [{ type: String, required: true }],
    category: { type: String, required: true },
    points: [{ type: String }] // Add points field as an array of strings
});

const design = mongoose.models.design || mongoose.model("design", designSchema);

export default design;
