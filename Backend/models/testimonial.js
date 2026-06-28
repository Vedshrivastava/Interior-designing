import mongoose from 'mongoose';

const testimonialSchema = new mongoose.Schema({
    name:      { type: String, required: true },
    location:  { type: String, required: true },
    text:      { type: String, required: true },
    rating:    { type: Number, required: true, min: 1, max: 5, default: 5 },
    image:     { type: String, default: '' },
    isActive:  { type: Boolean, default: true },
    deleted:   { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
}, { timestamps: true });

const Testimonial = mongoose.models.testimonial || mongoose.model('testimonial', testimonialSchema);
export default Testimonial;
