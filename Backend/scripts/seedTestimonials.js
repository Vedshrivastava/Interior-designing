import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const testimonialSchema = new mongoose.Schema({
    name:      { type: String, required: true },
    location:  { type: String, required: true },
    text:      { type: String, required: true },
    rating:    { type: Number, default: 5 },
    image:     { type: String, default: '' },
    isActive:  { type: Boolean, default: true },
    deleted:   { type: Boolean, default: false },
}, { timestamps: true });

const Testimonial = mongoose.models.testimonial || mongoose.model('testimonial', testimonialSchema);

const testimonials = [
    {
        name: 'Rahul Mehta',
        location: 'Mumbai',
        rating: 5,
        text: 'Exceptional execution and genuinely luxurious finishing. Every material, proportion and detail was considered, and the finished space matched the 3D render they showed us months earlier almost exactly. That kind of accuracy is rare.',
    },
    {
        name: 'Priya Sharma',
        location: 'Delhi',
        rating: 5,
        text: 'Their design sense is outstanding. Every corner of our apartment feels premium and considered, like the space was always meant to look this way. They listened carefully to how we actually live and you can see that in the result.',
    },
    {
        name: 'Aman Verma',
        location: 'Bangalore',
        rating: 5,
        text: 'Professional, transparent and highly skilled. I could see every finish and furniture placement in the 3D before work started, which gave me real confidence going in. The execution matched it perfectly with no surprises at all.',
    },
    {
        name: 'Neha Joshi',
        location: 'Pune',
        rating: 5,
        text: 'From the first consultation to handover, the whole process was smooth and genuinely stress-free. They handled every contractor, delivery and site call. I just showed up on handover day and walked into a finished home.',
    },
    {
        name: 'Vikram Singh',
        location: 'Indore',
        rating: 5,
        text: 'We got a genuinely luxurious interior within our budget, with no compromise on quality or finish. The materials are premium and the craftsmanship is immaculate. Two other designers had quoted us more for a noticeably lower standard of work.',
    },
    {
        name: 'Sunita Agarwal',
        location: 'Bhopal',
        rating: 5,
        text: 'The 3D renders were absolutely spot-on. We knew exactly what we were getting before any work started, which took away all the usual anxiety. The finished space is identical to what we approved in the render. That level of accuracy is rare.',
    },
];

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    let inserted = 0;
    for (const t of testimonials) {
        const exists = await Testimonial.findOne({ name: t.name, location: t.location });
        if (exists) {
            console.log(`⏭  Skipped (already exists): ${t.name}`);
        } else {
            await Testimonial.create(t);
            console.log(`✅ Inserted: ${t.name}`);
            inserted++;
        }
    }

    console.log(`\nDone — ${inserted} inserted, ${testimonials.length - inserted} skipped.`);
    await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
