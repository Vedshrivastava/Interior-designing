import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listGstFilings, saveGstFiling, removeGstFiling } from '../controllers/financeGstFiling.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listGstFilings);
router.post('/save',     adminAuthMiddleware, saveGstFiling);
router.delete('/remove', adminAuthMiddleware, removeGstFiling);

export default router;
