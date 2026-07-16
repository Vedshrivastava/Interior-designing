import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listLabourDeductions, addLabourDeduction, removeLabourDeduction } from '../controllers/financeLabourDeduction.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listLabourDeductions);
router.post('/add',      adminAuthMiddleware, addLabourDeduction);
router.delete('/remove', adminAuthMiddleware, removeLabourDeduction);

export default router;
