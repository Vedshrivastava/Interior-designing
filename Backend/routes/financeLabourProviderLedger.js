import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getLabourProviderLedger } from '../controllers/financeLabourProviderLedger.js';

const router = express.Router();

// Mounted at the same '/api/finance/vendors' prefix as routes/financeVendor.js,
// financeVendorLedger.js, and financeCommissionLedger.js — one more router
// on that prefix, one per ledger concern.
router.get('/:vendorId/labour-provider-ledger', adminAuthMiddleware, getLabourProviderLedger);

export default router;
