import mongoose from 'mongoose';

const specialitySchema = new mongoose.Schema({
    name:      { type: String, required: true, unique: true },
    icon:      { type: String, default: 'check' },  // icon key e.g. 'droplet', 'sun'
    color:     { type: String, default: '#c9a87c' }, // hex color
    order:     { type: Number, default: 999 },
    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const Speciality = mongoose.models.speciality || mongoose.model('speciality', specialitySchema);
export default Speciality;
