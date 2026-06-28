import Testimonial from '../models/testimonial.js';
import { v2 as cloudinary } from 'cloudinary';
import { broadcast } from '../middlewares/webSocket.js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key:    process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const addTestimonial = async (req, res) => {
    try {
        let imageUrl = '';
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, { folder: 'testimonials' });
            imageUrl = result.secure_url;
            fs.unlinkSync(req.file.path);
        }

        const testimonial = new Testimonial({
            name:     req.body.name,
            location: req.body.location,
            text:     req.body.text,
            rating:   parseInt(req.body.rating) || 5,
            image:    imageUrl,
            isActive: req.body.isActive !== 'false',
        });

        await testimonial.save();
        broadcast({ type: 'testimonialsChanged' });
        res.json({ success: true, message: 'Testimonial added' });
    } catch (error) {
        console.error('Error adding testimonial:', error);
        res.status(500).json({ success: false, message: 'Error adding testimonial' });
    }
};

const listTestimonials = async (req, res) => {
    try {
        const filter = { deleted: { $ne: true } };
        if (req.query.activeOnly === 'true') filter.isActive = true;
        const testimonials = await Testimonial.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data: testimonials });
    } catch (error) {
        console.error('Error listing testimonials:', error);
        res.status(500).json({ success: false, message: 'Error fetching testimonials' });
    }
};

const removeTestimonial = async (req, res) => {
    try {
        const { id } = req.body;
        const t = await Testimonial.findById(id);
        if (!t) return res.status(404).json({ success: false, message: 'Not found' });

        t.deleted   = true;
        t.deletedAt = new Date();
        t.deletedBy = req.userName || 'Admin';
        await t.save();

        broadcast({ type: 'testimonialsChanged' });
        res.json({ success: true, message: 'Testimonial removed' });
    } catch (error) {
        console.error('Error removing testimonial:', error);
        res.status(500).json({ success: false, message: 'Error removing testimonial' });
    }
};

const updateTestimonial = async (req, res) => {
    try {
        const { id, name, location, text, rating, isActive } = req.body;
        const t = await Testimonial.findById(id);
        if (!t) return res.status(404).json({ success: false, message: 'Not found' });

        if (req.file) {
            if (t.image) {
                const publicId = t.image.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, '');
                await cloudinary.uploader.destroy(publicId).catch(() => {});
            }
            const result = await cloudinary.uploader.upload(req.file.path, { folder: 'testimonials' });
            t.image = result.secure_url;
            fs.unlinkSync(req.file.path);
        }

        if (name)     t.name     = name;
        if (location) t.location = location;
        if (text)     t.text     = text;
        if (rating)   t.rating   = parseInt(rating);
        if (isActive !== undefined) t.isActive = isActive !== 'false';

        await t.save();
        broadcast({ type: 'testimonialsChanged' });
        res.json({ success: true, message: 'Testimonial updated' });
    } catch (error) {
        console.error('Error updating testimonial:', error);
        res.status(500).json({ success: false, message: 'Error updating testimonial' });
    }
};

export { addTestimonial, listTestimonials, removeTestimonial, updateTestimonial };
