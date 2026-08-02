import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getSalaryLedger, getSalaryLedgersBatch } from '../controllers/financeSalaryLedger.js';

const router = express.Router();

// Mounted at the same '/api/finance/employees' prefix as routes/financeEmployee.js
// (list/add/update/remove) — a separate router file for the ledger concern,
// same split used for the Contractor/Vendor ledgers. Registered before the
// :employeeId param route only by convention — no collision either way,
// since this is a single path segment and :employeeId/salary-ledger is two.
router.get('/salary-ledgers-batch', adminAuthMiddleware, getSalaryLedgersBatch);
router.get('/:employeeId/salary-ledger', adminAuthMiddleware, getSalaryLedger);

export default router;
