import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listProjectPhotos, addProjectPhotos, removeProjectPhoto } from '../controllers/financeProjectPhoto.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/list',    adminAuthMiddleware, listProjectPhotos);
router.post('/add',    adminAuthMiddleware, upload.array('images', 20), addProjectPhotos);
router.post('/remove', adminAuthMiddleware, removeProjectPhoto);

export default router;
