import Project from "../models/project.js";
import { v2 as cloudinary } from 'cloudinary';
import { broadcast } from '../middlewares/webSocket.js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key:    process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

const addProject = async (req, res) => {
    try {
        let imageUrls = [];

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const result = await cloudinary.uploader.upload(file.path, { folder: 'project_images' });
                    imageUrls.push(result.secure_url);
                    fs.unlinkSync(file.path);
                } catch (uploadError) {
                    console.error(`Error uploading file ${file.path}:`, uploadError);
                }
            }
        }

        const project = new Project({
            name:              req.body.name,
            description:       req.body.description,
            category:          req.body.category,
            images:            imageUrls,
            points:            req.body.points ? JSON.parse(req.body.points) : [],
            isFeatured:        req.body.isFeatured === 'true',
            location:          req.body.location,
            projectType:       req.body.projectType,
            area:              req.body.area || '',
            duration:          req.body.duration || '',
            completedAt:       req.body.completedAt || undefined,
            clientTestimonial: req.body.clientTestimonial || '',
        });

        await project.save();
        broadcast({ type: 'projectsChanged' });
        res.json({ success: true, message: 'Project Added' });
    } catch (error) {
        console.error('Error adding project:', error);
        res.status(500).json({ success: false, message: 'Error adding project' });
    }
};

const listProjects = async (req, res) => {
    try {
        const { category, projectType } = req.query;
        const filter = {};

        if (category)    filter.category    = category;
        if (projectType) filter.projectType = projectType;
        filter.deleted = { $ne: true };

        const projects = await Project.find(filter).sort({ completedAt: -1 });
        res.json({ success: true, data: projects });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ success: false, message: 'Error fetching projects' });
    }
};

const removeProject = async (req, res) => {
    const { _id } = req.body;

    try {
        const project = await Project.findById(_id);

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        project.deleted   = true;
        project.deletedAt = new Date();
        project.deletedBy = req.userName || 'Admin';
        await project.save();
        broadcast({ type: 'projectsChanged' });
        res.json({ success: true, message: 'Project moved to Recovery Bin' });
    } catch (error) {
        console.error('Error removing project:', error);
        res.status(500).json({ success: false, message: 'Error removing project' });
    }
};

const updateProject = async (req, res) => {
    try {
        const {
            _id, name, description, category, points,
            existingImages, location, projectType, area, duration,
            completedAt, clientTestimonial
        } = req.body;

        const parsedPoints         = points         ? JSON.parse(points)         : [];
        const parsedExistingImages = existingImages ? JSON.parse(existingImages) : [];

        const existingProject = await Project.findById(_id);
        if (!existingProject) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        // Delete images the admin chose to remove
        const imagesToDelete = existingProject.images.filter(img => !parsedExistingImages.includes(img));
        for (const imageUrl of imagesToDelete) {
            try {
                const publicId = imageUrl.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`project_images/${publicId}`);
            } catch (deleteError) {
                console.error('Error deleting image from Cloudinary:', deleteError);
            }
        }

        // Upload any newly added images
        let newImageUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const result = await cloudinary.uploader.upload(file.path, { folder: 'project_images' });
                    newImageUrls.push(result.secure_url);
                    fs.unlinkSync(file.path);
                } catch (uploadError) {
                    console.error('Upload error:', uploadError);
                }
            }
        }

        const updateData = {
            name,
            description,
            category,
            points:            parsedPoints,
            isFeatured:        req.body.isFeatured === 'true',
            images:            [...parsedExistingImages, ...newImageUrls],
            location,
            projectType,
            area:              area              || '',
            duration:          duration          || '',
            completedAt:       completedAt       || undefined,
            clientTestimonial: clientTestimonial || '',
        };

        await Project.findByIdAndUpdate(_id, updateData, { new: true });
        broadcast({ type: 'projectsChanged' });
        res.json({ success: true, message: 'Project Updated Successfully' });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ success: false, message: 'Error updating project' });
    }
};

export { addProject, listProjects, removeProject, updateProject };
