import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listCommissionPayments, addCommissionPayment, updateCommissionPayment, removeCommissionPayment } from '../controllers/financeCommissionPayment.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listCommissionPayments);
router.post('/add',    adminAuthMiddleware, addCommissionPayment);
router.post('/update', adminAuthMiddleware, updateCommissionPayment);
router.delete('/remove', adminAuthMiddleware, removeCommissionPayment);

export default router;
