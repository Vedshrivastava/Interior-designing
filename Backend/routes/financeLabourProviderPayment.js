import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listLabourProviderPayments, addLabourProviderPayment, updateLabourProviderPayment, removeLabourProviderPayment } from '../controllers/financeLabourProviderPayment.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listLabourProviderPayments);
router.post('/add',      adminAuthMiddleware, addLabourProviderPayment);
router.post('/update',   adminAuthMiddleware, updateLabourProviderPayment);
router.delete('/remove', adminAuthMiddleware, removeLabourProviderPayment);

export default router;
