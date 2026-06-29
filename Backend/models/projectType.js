import mongoose from 'mongoose';

const projectTypeSchema = new mongoose.Schema({
    name:      { type: String, required: true, unique: true },
    order:     { type: Number, default: 999 },
    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const ProjectType = mongoose.models.projectType || mongoose.model('projectType', projectTypeSchema);
export default ProjectType;
