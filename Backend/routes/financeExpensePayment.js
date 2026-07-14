import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listExpensePayments, addExpensePayment, removeExpensePayment } from '../controllers/financeExpensePayment.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listExpensePayments);
router.post('/add',    adminAuthMiddleware, addExpensePayment);
router.post('/remove', adminAuthMiddleware, removeExpensePayment);

export default router;
