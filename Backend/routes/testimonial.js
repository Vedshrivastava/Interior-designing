import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { addTestimonial, listTestimonials, removeTestimonial, updateTestimonial } from '../controllers/testimonial.js';

const testimonialRouter = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

testimonialRouter.post('/add',    adminAuthMiddleware, upload.single('image'), addTestimonial);
testimonialRouter.get('/list',    listTestimonials);
testimonialRouter.delete('/remove', adminAuthMiddleware, removeTestimonial);
testimonialRouter.post('/update', adminAuthMiddleware, upload.single('image'), updateTestimonial);

export default testimonialRouter;
