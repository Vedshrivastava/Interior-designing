import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listContractorPayments, addContractorPayment, updateContractorPayment, removeContractorPayment } from '../controllers/financeContractorPayment.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/list',    adminAuthMiddleware, listContractorPayments);
router.post('/add',    adminAuthMiddleware, upload.single('attachment'), addContractorPayment);
router.post('/update', adminAuthMiddleware, upload.single('attachment'), updateContractorPayment);
router.delete('/remove', adminAuthMiddleware, removeContractorPayment);

export default router;
