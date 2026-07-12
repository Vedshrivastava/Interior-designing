import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getReceivablesSummary } from '../controllers/financeReceivable.js';

const router = express.Router();

router.get('/summary', adminAuthMiddleware, getReceivablesSummary);

export default router;
