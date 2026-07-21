import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listFinanceReferrals, addFinanceReferral, updateFinanceReferral, removeFinanceReferral, addReferralDocument, removeReferralDocument } from '../controllers/financeReferral.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/list',    adminAuthMiddleware, listFinanceReferrals);
router.post('/add',    adminAuthMiddleware, upload.array('documents', 6), addFinanceReferral);
router.post('/update', adminAuthMiddleware, updateFinanceReferral);
router.post('/remove', adminAuthMiddleware, removeFinanceReferral);
router.post('/documents/add',    adminAuthMiddleware, upload.single('document'), addReferralDocument);
router.post('/documents/remove', adminAuthMiddleware, removeReferralDocument);

export default router;
