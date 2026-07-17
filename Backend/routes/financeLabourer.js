import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listLabourers, addLabourer, updateLabourer, removeLabourer } from '../controllers/financeLabourer.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/list',    adminAuthMiddleware, listLabourers);
router.post('/add',    adminAuthMiddleware, upload.array('documents', 6), addLabourer);
router.post('/update', adminAuthMiddleware, updateLabourer);
router.post('/remove', adminAuthMiddleware, removeLabourer);

export default router;
