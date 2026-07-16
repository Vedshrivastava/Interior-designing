import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getLabourLedger } from '../controllers/financeLabourLedger.js';

const router = express.Router();

router.get('/:labourerId/ledger', adminAuthMiddleware, getLabourLedger);

export default router;
