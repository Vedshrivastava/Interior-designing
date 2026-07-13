import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listBankTransfers, addBankTransfer, removeBankTransfer } from '../controllers/financeBankTransfer.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listBankTransfers);
router.post('/add',    adminAuthMiddleware, addBankTransfer);
router.delete('/remove', adminAuthMiddleware, removeBankTransfer);

export default router;
