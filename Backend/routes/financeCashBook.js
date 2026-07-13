import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { getCashBookSummary } from '../controllers/financeCashBook.js';

const router = express.Router();

router.get('/summary', adminAuthMiddleware, getCashBookSummary);

export default router;
