import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listContractorDeductions, addContractorDeduction, updateContractorDeduction, removeContractorDeduction } from '../controllers/financeContractorDeduction.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listContractorDeductions);
router.post('/add',    adminAuthMiddleware, addContractorDeduction);
router.post('/update', adminAuthMiddleware, updateContractorDeduction);
router.delete('/remove', adminAuthMiddleware, removeContractorDeduction);

export default router;
