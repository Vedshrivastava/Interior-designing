import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listFinanceSettings, addFinanceSetting, updateFinanceSetting, removeFinanceSetting } from '../controllers/financeSetting.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listFinanceSettings);
router.post('/add',    adminAuthMiddleware, addFinanceSetting);
router.post('/update', adminAuthMiddleware, updateFinanceSetting);
router.post('/remove', adminAuthMiddleware, removeFinanceSetting);

export default router;
