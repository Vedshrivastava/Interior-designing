import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listLabourers, addLabourer, updateLabourer, removeLabourer } from '../controllers/financeLabourer.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listLabourers);
router.post('/add',    adminAuthMiddleware, addLabourer);
router.post('/update', adminAuthMiddleware, updateLabourer);
router.post('/remove', adminAuthMiddleware, removeLabourer);

export default router;
