import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listExpenses, addExpense, updateExpense, removeExpense } from '../controllers/financeExpense.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listExpenses);
router.post('/add',    adminAuthMiddleware, addExpense);
router.post('/update', adminAuthMiddleware, updateExpense);
router.delete('/remove', adminAuthMiddleware, removeExpense);

export default router;
