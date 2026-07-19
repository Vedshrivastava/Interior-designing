import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listSiteDiaryEntries, addSiteDiaryEntry, resolveSiteDiaryIssue, removeSiteDiaryEntry } from '../controllers/financeSiteDiary.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listSiteDiaryEntries);
router.post('/add',      adminAuthMiddleware, addSiteDiaryEntry);
router.post('/resolve',  adminAuthMiddleware, resolveSiteDiaryIssue);
router.delete('/remove', adminAuthMiddleware, removeSiteDiaryEntry);

export default router;
