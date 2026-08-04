import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listPurchases, addPurchase, updatePurchase, removePurchase } from '../controllers/financePurchase.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listPurchases);
router.post('/add',    adminAuthMiddleware, addPurchase);
router.post('/update', adminAuthMiddleware, updatePurchase);
router.delete('/remove', adminAuthMiddleware, removePurchase);

export default router;
