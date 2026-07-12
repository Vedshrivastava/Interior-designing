import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listFinanceClients, addFinanceClient, updateFinanceClient, removeFinanceClient } from '../controllers/financeClient.js';

const router = express.Router();

// Finance data is confidential — every route requires admin auth, including list.
router.get('/list',    adminAuthMiddleware, listFinanceClients);
router.post('/add',    adminAuthMiddleware, addFinanceClient);
router.post('/update', adminAuthMiddleware, updateFinanceClient);
router.post('/remove', adminAuthMiddleware, removeFinanceClient);

export default router;
