import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getSalaryLedger } from '../controllers/financeSalaryLedger.js';

const router = express.Router();

// Mounted at the same '/api/finance/employees' prefix as routes/financeEmployee.js
// (list/add/update/remove) — a separate router file for the ledger concern,
// same split used for the Contractor/Vendor ledgers.
router.get('/:employeeId/salary-ledger', adminAuthMiddleware, getSalaryLedger);

export default router;
