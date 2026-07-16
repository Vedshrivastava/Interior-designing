import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listSupervisorDeductions, addSupervisorDeduction, removeSupervisorDeduction } from '../controllers/financeSupervisorDeduction.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listSupervisorDeductions);
router.post('/add',      adminAuthMiddleware, addSupervisorDeduction);
router.delete('/remove', adminAuthMiddleware, removeSupervisorDeduction);

export default router;
