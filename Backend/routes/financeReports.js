import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import {
    getProjectProfit, getClientProfit, getWorkProfit,
    getContractorAnalysis, getVendorAnalysis, getMaterialAnalysis,
    getCashFlow, getExpenseAnalysis,
} from '../controllers/financeReports.js';

const router = express.Router();

// Every route here is GET-only — Reports is a pure read-only rollup over
// data every other finance module already writes; nothing is created,
// updated, or removed from this router.
router.get('/project-profit',      adminAuthMiddleware, getProjectProfit);
router.get('/client-profit',       adminAuthMiddleware, getClientProfit);
router.get('/work-profit',         adminAuthMiddleware, getWorkProfit);
router.get('/contractor-analysis', adminAuthMiddleware, getContractorAnalysis);
router.get('/vendor-analysis',     adminAuthMiddleware, getVendorAnalysis);
router.get('/material-analysis',   adminAuthMiddleware, getMaterialAnalysis);
router.get('/cash-flow',           adminAuthMiddleware, getCashFlow);
router.get('/expense-analysis',    adminAuthMiddleware, getExpenseAnalysis);

export default router;
