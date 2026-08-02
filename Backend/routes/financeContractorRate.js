import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listContractorRates, addContractorRate, updateContractorRate, removeContractorRate } from '../controllers/financeContractorRate.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listContractorRates);
router.post('/add',    adminAuthMiddleware, addContractorRate);
router.post('/update', adminAuthMiddleware, updateContractorRate);
router.post('/remove', adminAuthMiddleware, removeContractorRate);

export default router;
