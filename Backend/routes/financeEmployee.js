import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listFinanceEmployees, addFinanceEmployee, updateFinanceEmployee, removeFinanceEmployee } from '../controllers/financeEmployee.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listFinanceEmployees);
router.post('/add',    adminAuthMiddleware, addFinanceEmployee);
router.post('/update', adminAuthMiddleware, updateFinanceEmployee);
router.post('/remove', adminAuthMiddleware, removeFinanceEmployee);

export default router;
