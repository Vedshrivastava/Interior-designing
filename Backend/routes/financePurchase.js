import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listPurchases, addPurchase, removePurchase } from '../controllers/financePurchase.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listPurchases);
router.post('/add',    adminAuthMiddleware, addPurchase);
router.delete('/remove', adminAuthMiddleware, removePurchase);

export default router;
