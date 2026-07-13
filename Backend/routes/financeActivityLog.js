import express from 'express';
import { listActivity } from '../controllers/financeActivityLog.js';
import { adminAuthMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.get('/list', adminAuthMiddleware, listActivity);

export default router;
