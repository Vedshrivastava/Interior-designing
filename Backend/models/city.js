import mongoose from 'mongoose';

const citySchema = new mongoose.Schema({
    name:       { type: String, required: true, unique: true },
    slug:       { type: String, required: true, unique: true },
    state:      { type: String, required: true },
    variations: { type: [String], default: [] },
    order:      { type: Number, default: 999 },
    deleted:    { type: Boolean, default: false },
    deletedAt:  { type: Date },
    deletedBy:  { type: String },
}, { timestamps: true });

const City = mongoose.models.city || mongoose.model('city', citySchema);
export default City;
