import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getContractorLedger } from '../controllers/financeContractorLedger.js';

const router = express.Router();

router.get('/:vendorId/ledger', adminAuthMiddleware, getContractorLedger);

export default router;
