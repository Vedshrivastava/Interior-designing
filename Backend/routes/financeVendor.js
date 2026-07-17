import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listFinanceVendors, addFinanceVendor, updateFinanceVendor, removeFinanceVendor, addVendorDocument, removeVendorDocument } from '../controllers/financeVendor.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/list',    adminAuthMiddleware, listFinanceVendors);
router.post('/add',    adminAuthMiddleware, upload.array('documents', 6), addFinanceVendor);
router.post('/update', adminAuthMiddleware, updateFinanceVendor);
router.post('/remove', adminAuthMiddleware, removeFinanceVendor);
router.post('/documents/add',    adminAuthMiddleware, upload.single('document'), addVendorDocument);
router.post('/documents/remove', adminAuthMiddleware, removeVendorDocument);

export default router;
