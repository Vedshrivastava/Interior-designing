import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import {
    getProjectProfit, getProjectProfitsBatch, getClientProfit, getWorkProfit, getWorkDetail,
    getContractorAnalysis, getContractorsSummary, getLabourAnalysis, getSupervisorAnalysis,
    getVendorAnalysis, getVendorsSummary,
    getMaterialAnalysis, getInventorySummary,
    getCashFlow, getExpenseAnalysis,
    getCaMonthlyPackage, downloadCaMonthlyPackage,
    getTdsPayable,
    getReconciliation,
    getDashboardSummary, getDashboardTrends,
    getClientsSummary, getClientDetail,
} from '../controllers/financeReports.js';

const router = express.Router();

// Every route here is GET-only — Reports is a pure read-only rollup over
// data every other finance module already writes; nothing is created,
// updated, or removed from this router. The two /download routes stream a
// PDF instead of JSON but are still GET, same read-only rule.
router.get('/project-profit',       adminAuthMiddleware, getProjectProfit);
router.get('/project-profits-batch', adminAuthMiddleware, getProjectProfitsBatch);
router.get('/client-profit',       adminAuthMiddleware, getClientProfit);
router.get('/work-profit',         adminAuthMiddleware, getWorkProfit);
router.get('/work-detail',         adminAuthMiddleware, getWorkDetail);
router.get('/contractor-analysis', adminAuthMiddleware, getContractorAnalysis);
router.get('/labour-analysis',     adminAuthMiddleware, getLabourAnalysis);
router.get('/supervisor-analysis', adminAuthMiddleware, getSupervisorAnalysis);
router.get('/vendor-analysis',     adminAuthMiddleware, getVendorAnalysis);
router.get('/material-analysis',   adminAuthMiddleware, getMaterialAnalysis);
router.get('/cash-flow',           adminAuthMiddleware, getCashFlow);
router.get('/expense-analysis',    adminAuthMiddleware, getExpenseAnalysis);
router.get('/ca-monthly-package',          adminAuthMiddleware, getCaMonthlyPackage);
router.get('/ca-monthly-package/download', adminAuthMiddleware, downloadCaMonthlyPackage);
router.get('/tds-payable',         adminAuthMiddleware, getTdsPayable);
router.get('/reconciliation',      adminAuthMiddleware, getReconciliation);

// Finance Dashboard — three-tier architecture
router.get('/dashboard-summary', adminAuthMiddleware, getDashboardSummary);
router.get('/dashboard-trends',  adminAuthMiddleware, getDashboardTrends);
router.get('/clients-summary',    adminAuthMiddleware, getClientsSummary);
router.get('/client-detail',      adminAuthMiddleware, getClientDetail);
router.get('/contractors-summary', adminAuthMiddleware, getContractorsSummary);
router.get('/vendors-summary',     adminAuthMiddleware, getVendorsSummary);
router.get('/inventory-summary',   adminAuthMiddleware, getInventorySummary);

export default router;
