import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getVendorLedger } from '../controllers/financeVendorLedger.js';

const router = express.Router();

// Mounted at the same '/api/finance/vendors' prefix as routes/financeVendor.js
// (list/add/update/remove) — a separate router file for the ledger concern,
// same split used for Contractors (financeContractorLedger.js alongside
// the vendor CRUD routes).
router.get('/:vendorId/ledger', adminAuthMiddleware, getVendorLedger);

export default router;
