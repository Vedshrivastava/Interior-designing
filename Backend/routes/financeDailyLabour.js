import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listDailyLabour, addDailyLabour, batchAddDailyLabour, approveDailyLabour, removeDailyLabour } from '../controllers/financeDailyLabour.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listDailyLabour);
router.post('/add',      adminAuthMiddleware, addDailyLabour);
router.post('/batch-add', adminAuthMiddleware, batchAddDailyLabour);
router.post('/approve',  adminAuthMiddleware, approveDailyLabour);
router.delete('/remove', adminAuthMiddleware, removeDailyLabour);

export default router;
