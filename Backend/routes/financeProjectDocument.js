import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listProjectDocuments, addProjectDocument, removeProjectDocument } from '../controllers/financeProjectDocument.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/list',    adminAuthMiddleware, listProjectDocuments);
router.post('/add',    adminAuthMiddleware, upload.single('file'), addProjectDocument);
router.post('/remove', adminAuthMiddleware, removeProjectDocument);

export default router;
