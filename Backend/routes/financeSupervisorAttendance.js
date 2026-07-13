import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listSupervisorAttendance, addSupervisorAttendance, removeSupervisorAttendance } from '../controllers/financeSupervisorAttendance.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listSupervisorAttendance);
router.post('/add',      adminAuthMiddleware, addSupervisorAttendance);
router.delete('/remove', adminAuthMiddleware, removeSupervisorAttendance);

export default router;
