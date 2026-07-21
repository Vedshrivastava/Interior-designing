import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getLabourProviderLedger } from '../controllers/financeLabourProviderLedger.js';

const router = express.Router();

// Mounted at '/api/finance/labour-providers' (routes/financeLabourProvider.js's
// own prefix) — a second router on that prefix, for this one ledger concern.
router.get('/:labourProviderId/labour-provider-ledger', adminAuthMiddleware, getLabourProviderLedger);

export default router;
