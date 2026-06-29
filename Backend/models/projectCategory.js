import mongoose from 'mongoose';

const projectCategorySchema = new mongoose.Schema({
    name:      { type: String, required: true, unique: true },
    order:     { type: Number, default: 999 },
    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const ProjectCategory = mongoose.models.projectCategory || mongoose.model('projectCategory', projectCategorySchema);
export default ProjectCategory;
