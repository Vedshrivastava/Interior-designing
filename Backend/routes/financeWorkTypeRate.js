import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listWorkTypeRates, addWorkTypeRate, removeWorkTypeRate } from '../controllers/financeWorkTypeRate.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listWorkTypeRates);
router.post('/add',    adminAuthMiddleware, addWorkTypeRate);
router.post('/remove', adminAuthMiddleware, removeWorkTypeRate);

export default router;
