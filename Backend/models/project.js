import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
    // ── Inherited from Design ──
    name:        { type: String, required: true },
    description: { type: String, required: true },
    images:      [{ type: String, required: true }],
    category:    { type: String, required: true },
    points:      [{ type: String }],
    isFeatured:  { type: Boolean, default: false },

    // ── Project-specific ──
    location:    { type: String, required: true },          // e.g. "Satna, MP"
    projectType: { type: String, enum: ['Residential', 'Commercial'], required: true },
    area:        { type: String },                          // e.g. "1500 sq.ft" or "3BHK"
    duration:    { type: String },                          // e.g. "6 weeks"
    completedAt: { type: Date },                            // handover date
    clientTestimonial: { type: String },                    // optional client quote
}, {
    timestamps: true                                        // createdAt + updatedAt
});

const Project = mongoose.models.project || mongoose.model("project", projectSchema);

export default Project;
