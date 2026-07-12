import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listFinanceVendors, addFinanceVendor, updateFinanceVendor, removeFinanceVendor } from '../controllers/financeVendor.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listFinanceVendors);
router.post('/add',    adminAuthMiddleware, addFinanceVendor);
router.post('/update', adminAuthMiddleware, updateFinanceVendor);
router.post('/remove', adminAuthMiddleware, removeFinanceVendor);

export default router;
