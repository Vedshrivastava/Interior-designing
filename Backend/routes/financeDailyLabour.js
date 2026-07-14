import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listDailyLabour, addDailyLabour, batchAddDailyLabour, removeDailyLabour } from '../controllers/financeDailyLabour.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listDailyLabour);
router.post('/add',      adminAuthMiddleware, addDailyLabour);
router.post('/batch-add', adminAuthMiddleware, batchAddDailyLabour);
router.delete('/remove', adminAuthMiddleware, removeDailyLabour);

export default router;
