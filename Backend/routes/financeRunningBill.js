import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import {
    listRunningBills, previewRunningBill, generateRunningBill,
    updateRunningBillGst, updateRunningBillStatus, removeRunningBill,
    getBillStatement, downloadBillStatement,
} from '../controllers/financeRunningBill.js';

const router = express.Router();

router.get('/preview', adminAuthMiddleware, previewRunningBill);
router.get('/list',    adminAuthMiddleware, listRunningBills);
router.post('/generate',    adminAuthMiddleware, generateRunningBill);
router.post('/update-gst',  adminAuthMiddleware, updateRunningBillGst);
router.post('/update',      adminAuthMiddleware, updateRunningBillStatus);
router.delete('/remove', adminAuthMiddleware, removeRunningBill);
router.get('/:id/statement',          adminAuthMiddleware, getBillStatement);
router.get('/:id/statement/download', adminAuthMiddleware, downloadBillStatement);

export default router;
