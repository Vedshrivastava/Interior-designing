import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { addProject, listProjects, removeProject, updateProject } from '../controllers/project.js';

const projectRouter = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage });

// Public
projectRouter.get('/list', listProjects);

// Protected
projectRouter.post('/add',    adminAuthMiddleware, upload.array('images', 10), addProject);
projectRouter.post('/update', adminAuthMiddleware, upload.array('images', 10), updateProject);
projectRouter.delete('/remove', adminAuthMiddleware, removeProject);

export default projectRouter;
