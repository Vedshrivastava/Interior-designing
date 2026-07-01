import Design from "../models/design.js";
import { v2 as cloudinary } from 'cloudinary';
import { broadcast } from '../middlewares/webSocket.js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

const addDesign = async (req, res) => {
    console.log('Request body:', req.body);
    console.log('Files:', req.files);
    console.log('the api key is ----->', process.env.CLOUD_API_KEY);

    try {
        let imageUrls = [];

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const result = await cloudinary.uploader.upload(file.path, {
                        folder: 'design_images'
                    });
                    imageUrls.push(result.secure_url);
                    fs.unlinkSync(file.path);
                    console.log(`Uploaded ${file.path} to Cloudinary with URL: ${result.secure_url}`);
                } catch (uploadError) {
                    console.error(`Error uploading file ${file.path}:`, uploadError);
                }
            }
        }

        // Capture the points field from the request body (as an array of strings)
        const points = req.body.points ? JSON.parse(req.body.points) : [];
        const subcategories = req.body.subcategories ? JSON.parse(req.body.subcategories) : [];

        const design = new Design({
            name: req.body.name,
            description: req.body.description,
            category: req.body.category,
            subcategories: subcategories,
            images: imageUrls,
            points: points,
            // Add this new line:
            isFeatured: req.body.isFeatured === 'true'
        });

        await design.save();
        broadcast({ type: 'designsChanged' });
        res.json({ success: true, message: 'Design Added' });
    } catch (error) {
        console.error('Error adding design:', error);
        res.status(500).json({ success: false, message: 'Error adding design' });
    }
};

const listDesigns = async (req, res) => {
    try {
        const { category, page, limit } = req.query;
        const filter = { deleted: { $ne: true } };
        if (category) filter.category = category;

        if (page || limit) {
            const pageNum  = Math.max(1, parseInt(page,  10) || 1);
            const limitNum = Math.max(1, parseInt(limit, 10) || 20);
            const skip     = (pageNum - 1) * limitNum;

            const [designs, total] = await Promise.all([
                Design.find(filter).sort({ _id: -1 }).skip(skip).limit(limitNum),
                Design.countDocuments(filter),
            ]);

            return res.json({
                success: true,
                data: designs,
                total,
                page: pageNum,
                totalPages: Math.ceil(total / limitNum),
                hasMore: pageNum * limitNum < total,
            });
        }

        // Legacy: no pagination params → return all (keeps Admin panel working)
        const designs = await Design.find(filter).sort({ _id: -1 });
        res.json({ success: true, data: designs });
    } catch (error) {
        console.error('Error fetching design list:', error);
        res.status(500).json({ success: false, message: 'Error fetching design list' });
    }
};


const removeDesign = async (req, res) => {
    const { _id } = req.body;

    try {
        const design = await Design.findById(_id);

        if (!design) {
            return res.status(404).json({ success: false, message: 'Design not found' });
        }

        design.deleted   = true;
        design.deletedAt = new Date();
        design.deletedBy = req.userName || 'Admin';
        await design.save();
        broadcast({ type: 'designsChanged' });
        res.json({ success: true, message: 'Design moved to Recovery Bin' });
    } catch (error) {
        console.error('Error removing design:', error);
        res.status(500).json({ success: false, message: 'Error removing design' });
    }
};

// --- ADD THIS NEW FUNCTION ---
const updateDesign = async (req, res) => {
    try {
        const { _id, name, description, category, points, subcategories, existingImages } = req.body;
        const parsedPoints = points ? JSON.parse(points) : [];
        const parsedSubcategories = subcategories ? JSON.parse(subcategories) : [];
        const parsedExistingImages = existingImages ? JSON.parse(existingImages) : []; // Images user chose to KEEP

// Find this block in updateDesign
let updateData = {
    name,
    description,
    category,
    subcategories: parsedSubcategories,
    points: parsedPoints,
    // Add this new line:
    isFeatured: req.body.isFeatured === 'true'
};

        const existingDesign = await Design.findById(_id);

        // 1. Delete removed images from Cloudinary
        const imagesToDelete = existingDesign.images.filter(img => !parsedExistingImages.includes(img));

        for (const imageUrl of imagesToDelete) {
            try {
                const publicId = imageUrl.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`design_images/${publicId}`);
                console.log(`Deleted removed image: ${publicId}`);
            } catch (deleteError) {
                console.error('Error deleting image from Cloudinary:', deleteError);
            }
        }

        // 2. Upload brand new images (if any were added)
        let newImageUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const result = await cloudinary.uploader.upload(file.path, { folder: 'design_images' });
                    newImageUrls.push(result.secure_url);
                    fs.unlinkSync(file.path);
                } catch (uploadError) {
                    console.error('Upload Error:', uploadError);
                }
            }
        }

        // 3. Combine the kept existing images with the newly uploaded images
        updateData.images = [...parsedExistingImages, ...newImageUrls];

        await Design.findByIdAndUpdate(_id, updateData, { new: true });
        broadcast({ type: 'designsChanged' });
        res.json({ success: true, message: 'Design Updated Successfully' });
    } catch (error) {
        console.error('Error updating design:', error);
        res.status(500).json({ success: false, message: 'Error updating design' });
    }
};

const appointments = async (req, res) => {

}

export { addDesign, listDesigns, removeDesign, appointments, updateDesign };
