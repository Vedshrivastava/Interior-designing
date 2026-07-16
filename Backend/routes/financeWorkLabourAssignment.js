import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listWorkLabourAssignments, addWorkLabourAssignment, removeWorkLabourAssignment } from '../controllers/financeWorkLabourAssignment.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listWorkLabourAssignments);
router.post('/add',    adminAuthMiddleware, addWorkLabourAssignment);
router.post('/remove', adminAuthMiddleware, removeWorkLabourAssignment);

export default router;
