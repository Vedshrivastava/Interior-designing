import express from 'express';
import { addDesign, listDesigns, removeDesign, appointments, updateDesign } from '../controllers/design.js'; // Added updateDesign here
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';

const designRouter = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => {
        return cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

// Add a design (Protected)
designRouter.post('/add', adminAuthMiddleware, upload.array('images', 10), addDesign);  

// List designs (Public)
designRouter.get('/list', listDesigns);

// Update/Edit a design (Protected) - ADDED THIS ROUTE
designRouter.post('/update', adminAuthMiddleware, upload.array('images', 10), updateDesign);

// Remove a design (Protected)
designRouter.delete('/remove', adminAuthMiddleware, removeDesign);

// Get appointments (Protected)
designRouter.get('/orders', adminAuthMiddleware, appointments);

export default designRouter;