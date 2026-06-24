import Product from "../models/product.js";
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

const addProduct = async (req, res) => {
    try {
        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const result = await cloudinary.uploader.upload(file.path, { folder: 'product_images' });
                    imageUrls.push(result.secure_url);
                    fs.unlinkSync(file.path);
                } catch (err) {
                    console.error(`Upload error for ${file.path}:`, err);
                }
            }
        }

        const product = new Product({
            name:         req.body.name,
            description:  req.body.description,
            category:     req.body.category,
            subcategory:  req.body.subcategory,
            material:     req.body.material     || '',
            finish:       req.body.finish        || '',
            specialities: req.body.specialities  ? JSON.parse(req.body.specialities)  : [],
            applications: req.body.applications  ? JSON.parse(req.body.applications)  : [],
            points:       req.body.points        ? JSON.parse(req.body.points)        : [],
            isFeatured:   req.body.isFeatured === 'true',
            images:       imageUrls,
        });

        await product.save();
        broadcast({ type: 'productsChanged' });
        res.json({ success: true, message: 'Product Added' });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ success: false, message: 'Error adding product' });
    }
};

const listProducts = async (req, res) => {
    try {
        const { category, subcategory } = req.query;
        const filter = {};
        if (category)    filter.category    = category;
        if (subcategory) filter.subcategory = subcategory;

        const products = await Product.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data: products });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ success: false, message: 'Error fetching products' });
    }
};

const removeProduct = async (req, res) => {
    const { _id } = req.body;
    try {
        const product = await Product.findById(_id);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        for (const url of product.images) {
            try {
                const publicId = url.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`product_images/${publicId}`);
            } catch (err) {
                console.error(`Error deleting image ${url}:`, err);
            }
        }

        await Product.findByIdAndDelete(_id);
        broadcast({ type: 'productsChanged' });
        res.json({ success: true, message: 'Product Removed' });
    } catch (error) {
        console.error('Error removing product:', error);
        res.status(500).json({ success: false, message: 'Error removing product' });
    }
};

const updateProduct = async (req, res) => {
    try {
        const {
            _id, name, description, category, subcategory,
            material, finish, specialities, applications,
            points, existingImages,
        } = req.body;

        const parsedSpecialities   = specialities    ? JSON.parse(specialities)    : [];
        const parsedApplications   = applications    ? JSON.parse(applications)    : [];
        const parsedPoints         = points          ? JSON.parse(points)          : [];
        const parsedExistingImages = existingImages  ? JSON.parse(existingImages)  : [];

        const existing = await Product.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

        // Delete images the admin removed
        for (const url of existing.images.filter(img => !parsedExistingImages.includes(img))) {
            try {
                const publicId = url.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`product_images/${publicId}`);
            } catch (err) {
                console.error('Error deleting image:', err);
            }
        }

        // Upload new images
        let newImageUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const result = await cloudinary.uploader.upload(file.path, { folder: 'product_images' });
                    newImageUrls.push(result.secure_url);
                    fs.unlinkSync(file.path);
                } catch (err) {
                    console.error('Upload error:', err);
                }
            }
        }

        const updated = await Product.findByIdAndUpdate(_id, {
            name, description, category, subcategory,
            material:     material     || '',
            finish:       finish       || '',
            specialities: parsedSpecialities,
            applications: parsedApplications,
            points:       parsedPoints,
            isFeatured:   req.body.isFeatured === 'true',
            images:       [...parsedExistingImages, ...newImageUrls],
        }, { new: true });

        broadcast({ type: 'productsChanged' });
        res.json({ success: true, message: 'Product Updated Successfully' });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ success: false, message: 'Error updating product' });
    }
};

export { addProduct, listProducts, removeProduct, updateProduct };
