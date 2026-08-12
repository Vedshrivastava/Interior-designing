import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listReceipts, addReceipt, updateReceipt, removeReceipt } from '../controllers/financeReceipt.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listReceipts);
router.post('/add',    adminAuthMiddleware, addReceipt);
router.post('/update', adminAuthMiddleware, updateReceipt);
router.delete('/remove', adminAuthMiddleware, removeReceipt);

export default router;
