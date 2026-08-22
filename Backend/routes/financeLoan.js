import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listLoans, addLoan, closeLoan, removeLoan, listLoanRepayments, addLoanRepayment, removeLoanRepayment } from '../controllers/financeLoan.js';

const router = express.Router();

router.get('/list',              adminAuthMiddleware, listLoans);
router.post('/add',              adminAuthMiddleware, addLoan);
router.post('/close',            adminAuthMiddleware, closeLoan);
router.delete('/remove',         adminAuthMiddleware, removeLoan);
router.get('/repayments/list',   adminAuthMiddleware, listLoanRepayments);
router.post('/repayments/add',   adminAuthMiddleware, addLoanRepayment);
router.delete('/repayments/remove', adminAuthMiddleware, removeLoanRepayment);

export default router;
