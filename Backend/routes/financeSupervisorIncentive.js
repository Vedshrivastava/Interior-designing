import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listSupervisorIncentives, addSupervisorIncentive, removeSupervisorIncentive } from '../controllers/financeSupervisorIncentive.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listSupervisorIncentives);
router.post('/add',      adminAuthMiddleware, addSupervisorIncentive);
router.delete('/remove', adminAuthMiddleware, removeSupervisorIncentive);

export default router;
