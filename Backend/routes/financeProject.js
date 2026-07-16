import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import {
    listFinanceProjects, getFinanceProject, addFinanceProject, updateFinanceProject,
    recordAdvanceInvoiced, recordAdvanceReceived, downloadAdvanceReceipt, activateFinanceProject, removeFinanceProject,
} from '../controllers/financeProject.js';

const router = express.Router();

router.get('/list',              adminAuthMiddleware, listFinanceProjects);
router.get('/:id/advance-receipt/download', adminAuthMiddleware, downloadAdvanceReceipt);
router.get('/:id',                adminAuthMiddleware, getFinanceProject);
router.post('/add',              adminAuthMiddleware, addFinanceProject);
router.post('/update',           adminAuthMiddleware, updateFinanceProject);
router.post('/advance-invoiced', adminAuthMiddleware, recordAdvanceInvoiced);
router.post('/advance-received', adminAuthMiddleware, recordAdvanceReceived);
router.post('/activate',         adminAuthMiddleware, activateFinanceProject);
router.post('/remove',           adminAuthMiddleware, removeFinanceProject);

export default router;
