import express from 'express';
import { masterAuthMiddleware } from '../middlewares/auth.js';
import { listFinanceBin, restoreFinanceItem, permanentDeleteFinanceItem } from '../controllers/financeRecovery.js';

const router = express.Router();

router.get('/bin',          masterAuthMiddleware, listFinanceBin);
router.post('/restore',     masterAuthMiddleware, restoreFinanceItem);
router.delete('/permanent', masterAuthMiddleware, permanentDeleteFinanceItem);

export default router;
