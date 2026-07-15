import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listClientDocuments, addClientDocument, removeClientDocument } from '../controllers/financeClientDocument.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/list',    adminAuthMiddleware, listClientDocuments);
router.post('/add',    adminAuthMiddleware, upload.single('file'), addClientDocument);
router.post('/remove', adminAuthMiddleware, removeClientDocument);

export default router;
