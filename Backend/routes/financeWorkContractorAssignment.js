import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listWorkContractorAssignments, addWorkContractorAssignment, removeWorkContractorAssignment } from '../controllers/financeWorkContractorAssignment.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listWorkContractorAssignments);
router.post('/add',    adminAuthMiddleware, addWorkContractorAssignment);
router.post('/remove', adminAuthMiddleware, removeWorkContractorAssignment);

export default router;
