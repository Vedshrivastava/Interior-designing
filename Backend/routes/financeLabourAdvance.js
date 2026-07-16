import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listLabourAdvances, addLabourAdvance, removeLabourAdvance } from '../controllers/financeLabourAdvance.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listLabourAdvances);
router.post('/add',      adminAuthMiddleware, addLabourAdvance);
router.delete('/remove', adminAuthMiddleware, removeLabourAdvance);

export default router;
