import mongoose from "mongoose";

const adminRequestSchema = new mongoose.Schema({
    name:    { type: String, required: true },
    email:   { type: String, required: true },
    reason:  { type: String, default: '' },
    status:  { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedAt: { type: Date },
}, { timestamps: true });

const AdminRequest = mongoose.models.adminRequest || mongoose.model("adminRequest", adminRequestSchema);
export default AdminRequest;
