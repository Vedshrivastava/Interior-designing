import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listCashEntries, addCashEntry, removeCashEntry } from '../controllers/financeCashEntry.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listCashEntries);
router.post('/add',    adminAuthMiddleware, addCashEntry);
router.delete('/remove', adminAuthMiddleware, removeCashEntry);

export default router;
