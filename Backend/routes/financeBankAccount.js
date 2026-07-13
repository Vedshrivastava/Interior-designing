import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listBankAccounts, addBankAccount, updateBankAccount, removeBankAccount, getBankStatement } from '../controllers/financeBankAccount.js';

const router = express.Router();

// POST /remove (not DELETE) so this plugs straight into the generic
// MasterCrudTable component the same way Clients/Vendors/Employees do.
router.get('/list',    adminAuthMiddleware, listBankAccounts);
router.post('/add',    adminAuthMiddleware, addBankAccount);
router.post('/update', adminAuthMiddleware, updateBankAccount);
router.post('/remove', adminAuthMiddleware, removeBankAccount);
router.get('/:id/statement', adminAuthMiddleware, getBankStatement);

export default router;
