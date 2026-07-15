import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listClientQuotations, addClientQuotation, updateClientQuotationStatus, removeClientQuotation } from '../controllers/financeClientQuotation.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listClientQuotations);
router.post('/add',    adminAuthMiddleware, addClientQuotation);
router.post('/status', adminAuthMiddleware, updateClientQuotationStatus);
router.post('/remove', adminAuthMiddleware, removeClientQuotation);

export default router;
