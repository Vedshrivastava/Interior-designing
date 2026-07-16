import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listWorkLabourAssignments, batchAddWorkLabourAssignment, removeWorkLabourAssignment } from '../controllers/financeWorkLabourAssignment.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listWorkLabourAssignments);
router.post('/add',    adminAuthMiddleware, batchAddWorkLabourAssignment);
router.post('/remove', adminAuthMiddleware, removeWorkLabourAssignment);

export default router;
