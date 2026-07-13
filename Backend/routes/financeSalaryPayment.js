import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listSalaryPayments, addSalaryPayment, updateSalaryPayment, removeSalaryPayment } from '../controllers/financeSalaryPayment.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listSalaryPayments);
router.post('/add',    adminAuthMiddleware, addSalaryPayment);
router.post('/update', adminAuthMiddleware, updateSalaryPayment);
router.delete('/remove', adminAuthMiddleware, removeSalaryPayment);

export default router;
