import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listFinanceTeams, addFinanceTeam, updateFinanceTeam, removeFinanceTeam } from '../controllers/financeTeam.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listFinanceTeams);
router.post('/add',    adminAuthMiddleware, addFinanceTeam);
router.post('/update', adminAuthMiddleware, updateFinanceTeam);
router.post('/remove', adminAuthMiddleware, removeFinanceTeam);

export default router;
