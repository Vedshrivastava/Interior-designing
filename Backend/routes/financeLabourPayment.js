import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listLabourPayments, addLabourPayment, removeLabourPayment } from '../controllers/financeLabourPayment.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listLabourPayments);
router.post('/add',      adminAuthMiddleware, addLabourPayment);
router.delete('/remove', adminAuthMiddleware, removeLabourPayment);

export default router;
