import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listClientDirectPayments, addClientDirectPayment, updateClientDirectPayment, removeClientDirectPayment } from '../controllers/financeClientDirectPayment.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listClientDirectPayments);
router.post('/add',    adminAuthMiddleware, addClientDirectPayment);
router.post('/update', adminAuthMiddleware, updateClientDirectPayment);
router.delete('/remove', adminAuthMiddleware, removeClientDirectPayment);

export default router;
