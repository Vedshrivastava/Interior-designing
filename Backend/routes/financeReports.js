import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import {
    getProjectProfit, getClientProfit, getWorkProfit,
    getContractorAnalysis, getVendorAnalysis, getMaterialAnalysis,
    getCashFlow, getExpenseAnalysis,
    getCaMonthlyPackage, downloadCaMonthlyPackage,
} from '../controllers/financeReports.js';

const router = express.Router();

// Every route here is GET-only — Reports is a pure read-only rollup over
// data every other finance module already writes; nothing is created,
// updated, or removed from this router. The two /download routes stream a
// PDF instead of JSON but are still GET, same read-only rule.
router.get('/project-profit',      adminAuthMiddleware, getProjectProfit);
router.get('/client-profit',       adminAuthMiddleware, getClientProfit);
router.get('/work-profit',         adminAuthMiddleware, getWorkProfit);
router.get('/contractor-analysis', adminAuthMiddleware, getContractorAnalysis);
router.get('/vendor-analysis',     adminAuthMiddleware, getVendorAnalysis);
router.get('/material-analysis',   adminAuthMiddleware, getMaterialAnalysis);
router.get('/cash-flow',           adminAuthMiddleware, getCashFlow);
router.get('/expense-analysis',    adminAuthMiddleware, getExpenseAnalysis);
router.get('/ca-monthly-package',          adminAuthMiddleware, getCaMonthlyPackage);
router.get('/ca-monthly-package/download', adminAuthMiddleware, downloadCaMonthlyPackage);

export default router;
