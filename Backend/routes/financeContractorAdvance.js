import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listContractorAdvances, addContractorAdvance, updateContractorAdvance, removeContractorAdvance } from '../controllers/financeContractorAdvance.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listContractorAdvances);
router.post('/add',    adminAuthMiddleware, addContractorAdvance);
router.post('/update', adminAuthMiddleware, updateContractorAdvance);
router.delete('/remove', adminAuthMiddleware, removeContractorAdvance);

export default router;
