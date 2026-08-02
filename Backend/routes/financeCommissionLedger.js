import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getCommissionLedger, getCommissionLedgersBatch } from '../controllers/financeCommissionLedger.js';

const router = express.Router();

// Mounted at '/api/finance/referrals' (routes/financeReferral.js's own
// prefix) — a second router on that prefix, for this one ledger concern.
// Batch route registered before the :referralId param route only by
// convention — no collision either way (different segment counts).
router.get('/commission-ledgers-batch', adminAuthMiddleware, getCommissionLedgersBatch);
router.get('/:referralId/commission-ledger', adminAuthMiddleware, getCommissionLedger);

export default router;
