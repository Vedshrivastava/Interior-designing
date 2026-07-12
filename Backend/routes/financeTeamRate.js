import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listTeamRates, addTeamRate, removeTeamRate } from '../controllers/financeTeamRate.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listTeamRates);
router.post('/add',    adminAuthMiddleware, addTeamRate);
router.post('/remove', adminAuthMiddleware, removeTeamRate);

export default router;
