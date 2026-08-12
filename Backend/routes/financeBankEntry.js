import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listBankEntries, addBankEntry, updateBankEntry, removeBankEntry } from '../controllers/financeBankEntry.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listBankEntries);
router.post('/add',      adminAuthMiddleware, addBankEntry);
router.post('/update',   adminAuthMiddleware, updateBankEntry);
router.delete('/remove', adminAuthMiddleware, removeBankEntry);

export default router;
