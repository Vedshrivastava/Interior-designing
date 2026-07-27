import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listTdsDeposits, addTdsDeposit, removeTdsDeposit } from '../controllers/financeTdsDeposit.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listTdsDeposits);
router.post('/add',      adminAuthMiddleware, addTdsDeposit);
router.delete('/remove', adminAuthMiddleware, removeTdsDeposit);

export default router;
