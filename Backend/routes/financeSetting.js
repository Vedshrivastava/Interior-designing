import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listFinanceSettings, addFinanceSetting, removeFinanceSetting } from '../controllers/financeSetting.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listFinanceSettings);
router.post('/add',    adminAuthMiddleware, addFinanceSetting);
router.post('/remove', adminAuthMiddleware, removeFinanceSetting);

export default router;
