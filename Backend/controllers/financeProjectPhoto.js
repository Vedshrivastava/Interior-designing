import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import FinanceProjectPhoto from '../models/financeProjectPhoto.js';
import { broadcast } from '../middlewares/webSocket.js';

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const listProjectPhotos = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const items = await FinanceProjectPhoto.find({ projectId, deleted: { $ne: true } }).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching photos' });
    }
};

const addProjectPhotos = async (req, res) => {
    try {
        const { projectId, caption } = req.body;
        if (!projectId) return res.status(400).json({ success: false, message: 'Project is required' });
        if (!req.files || !req.files.length) return res.status(400).json({ success: false, message: 'At least one photo is required' });

        const imageUrls = [];
        for (const file of req.files) {
            try {
                const result = await cloudinary.uploader.upload(file.path, { folder: 'finance_project_photos' });
                imageUrls.push(result.secure_url);
            } catch (uploadError) {
                console.error(`Error uploading file ${file.path}:`, uploadError);
            } finally {
                fs.unlinkSync(file.path);
            }
        }
        if (!imageUrls.length) return res.status(500).json({ success: false, message: 'Error uploading photos' });

        const items = await FinanceProjectPhoto.insertMany(
            imageUrls.map(imageUrl => ({ projectId, imageUrl, caption: caption || '' }))
        );
        broadcast({ type: 'financeProjectPhotosChanged', projectId });
        res.json({ success: true, message: `${items.length} photo${items.length === 1 ? '' : 's'} added`, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding photos' });
    }
};

const removeProjectPhoto = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceProjectPhoto.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeProjectPhotosChanged', projectId: item.projectId });
        res.json({ success: true, message: 'Photo removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing photo' });
    }
};

export { listProjectPhotos, addProjectPhotos, removeProjectPhoto };
