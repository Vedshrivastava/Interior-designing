import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listLabourRates, addLabourRate, removeLabourRate } from '../controllers/financeLabourRate.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listLabourRates);
router.post('/add',    adminAuthMiddleware, addLabourRate);
router.post('/remove', adminAuthMiddleware, removeLabourRate);

export default router;
