import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listFinanceLabourProviders, addFinanceLabourProvider, updateFinanceLabourProvider, removeFinanceLabourProvider, addLabourProviderDocument, removeLabourProviderDocument } from '../controllers/financeLabourProvider.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/list',    adminAuthMiddleware, listFinanceLabourProviders);
router.post('/add',    adminAuthMiddleware, upload.array('documents', 6), addFinanceLabourProvider);
router.post('/update', adminAuthMiddleware, updateFinanceLabourProvider);
router.post('/remove', adminAuthMiddleware, removeFinanceLabourProvider);
router.post('/documents/add',    adminAuthMiddleware, upload.single('document'), addLabourProviderDocument);
router.post('/documents/remove', adminAuthMiddleware, removeLabourProviderDocument);

export default router;
