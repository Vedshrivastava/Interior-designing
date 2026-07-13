import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getCommissionLedger } from '../controllers/financeCommissionLedger.js';

const router = express.Router();

// Mounted at the same '/api/finance/vendors' prefix as routes/financeVendor.js
// and routes/financeVendorLedger.js (the purchase ledger) — a third router
// on that prefix, one per ledger concern.
router.get('/:vendorId/commission-ledger', adminAuthMiddleware, getCommissionLedger);

export default router;
