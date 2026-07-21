import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getCommissionLedger } from '../controllers/financeCommissionLedger.js';

const router = express.Router();

// Mounted at '/api/finance/referrals' (routes/financeReferral.js's own
// prefix) — a second router on that prefix, for this one ledger concern.
router.get('/:referralId/commission-ledger', adminAuthMiddleware, getCommissionLedger);

export default router;
