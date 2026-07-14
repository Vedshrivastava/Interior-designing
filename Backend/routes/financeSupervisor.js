import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getLabourPayable } from '../controllers/financeSupervisorLabourPayment.js';

// Supervisor-specific (as opposed to employee-generic) endpoints live here —
// currently just the one, but a distinct base path from /api/finance/employees
// keeps room for more without conflating the two concepts.
const router = express.Router();

router.get('/:employeeId/labour-payable', adminAuthMiddleware, getLabourPayable);

export default router;
