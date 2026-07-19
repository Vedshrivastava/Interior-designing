import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getLabourLedger, downloadLabourBillStatement } from '../controllers/financeLabourLedger.js';

const router = express.Router();

router.get('/:labourerId/ledger', adminAuthMiddleware, getLabourLedger);
router.get('/:labourerId/ledger/download', adminAuthMiddleware, downloadLabourBillStatement);

export default router;
