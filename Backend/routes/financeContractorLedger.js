import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getContractorLedger, downloadContractorBillStatement } from '../controllers/financeContractorLedger.js';

const router = express.Router();

router.get('/:vendorId/ledger', adminAuthMiddleware, getContractorLedger);
router.get('/:vendorId/ledger/download', adminAuthMiddleware, downloadContractorBillStatement);

export default router;
