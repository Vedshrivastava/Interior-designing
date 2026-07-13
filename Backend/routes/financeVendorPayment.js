import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listVendorPayments, addVendorPayment, updateVendorPayment, removeVendorPayment } from '../controllers/financeVendorPayment.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/list',    adminAuthMiddleware, listVendorPayments);
router.post('/add',    adminAuthMiddleware, upload.single('attachment'), addVendorPayment);
router.post('/update', adminAuthMiddleware, upload.single('attachment'), updateVendorPayment);
router.delete('/remove', adminAuthMiddleware, removeVendorPayment);

export default router;
