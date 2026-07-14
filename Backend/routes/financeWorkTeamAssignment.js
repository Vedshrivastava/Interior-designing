import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listWorkTeamAssignments, addWorkTeamAssignment, removeWorkTeamAssignment } from '../controllers/financeWorkTeamAssignment.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listWorkTeamAssignments);
router.post('/add',    adminAuthMiddleware, addWorkTeamAssignment);
router.post('/remove', adminAuthMiddleware, removeWorkTeamAssignment);

export default router;
