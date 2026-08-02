import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listWorkTypeRates, addWorkTypeRate, updateWorkTypeRate, removeWorkTypeRate } from '../controllers/financeWorkTypeRate.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listWorkTypeRates);
router.post('/add',    adminAuthMiddleware, addWorkTypeRate);
router.post('/update', adminAuthMiddleware, updateWorkTypeRate);
router.post('/remove', adminAuthMiddleware, removeWorkTypeRate);

export default router;
