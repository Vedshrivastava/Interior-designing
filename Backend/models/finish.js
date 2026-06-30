import mongoose from 'mongoose';

const finishSchema = new mongoose.Schema({
    name:      { type: String, required: true, unique: true },
    icon:      { type: String, default: 'check' },  // Iconify icon ID e.g. 'mdi:blur'
    color:     { type: String, default: '#c9a87c' }, // hex color
    order:     { type: Number, default: 999 },
    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const Finish = mongoose.models.finish || mongoose.model('finish', finishSchema);
export default Finish;
