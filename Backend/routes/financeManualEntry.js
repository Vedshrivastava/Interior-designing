import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listManualEntries, addManualEntry, updateManualEntry, approveManualEntry, rejectManualEntry, markManualEntryPaid, removeManualEntry } from '../controllers/financeManualEntry.js';

const router = express.Router();

router.get('/list',       adminAuthMiddleware, listManualEntries);
router.post('/add',       adminAuthMiddleware, addManualEntry);
router.post('/update',    adminAuthMiddleware, updateManualEntry);
router.post('/approve',   adminAuthMiddleware, approveManualEntry);
router.post('/reject',    adminAuthMiddleware, rejectManualEntry);
router.post('/mark-paid', adminAuthMiddleware, markManualEntryPaid);
router.delete('/remove',  adminAuthMiddleware, removeManualEntry);

export default router;
