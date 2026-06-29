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
    projectType: { type: String, required: true },
    area:        { type: String },                          // e.g. "1500 sq.ft" or "3BHK"
    duration:    { type: String },                          // e.g. "6 weeks"
    completedAt: { type: Date },                            // handover date
    clientTestimonial: { type: String },
    cityPage:          { type: String, default: '' },   // slug of city page, e.g. 'mumbai'
    deleted:           { type: Boolean, default: false },
    deletedAt:         { type: Date },
    deletedBy:         { type: String },
}, {
    timestamps: true,
});

const Project = mongoose.models.project || mongoose.model("project", projectSchema);

export default Project;
