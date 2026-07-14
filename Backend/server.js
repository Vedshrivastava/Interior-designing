import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import http from "http"; // Import http to create the server
import { connectDB } from './config/db.js';
import designRouter from "./routes/design.js";
import projectRouter from "./routes/project.js";
import productRouter   from "./routes/product.js";
import requestsRouter     from "./routes/requests.js";
import testimonialRouter  from "./routes/testimonial.js";
import router from "./routes/appointments.js";
import admin from "./routes/admin.js";
import user from "./routes/user.js";
import recoveryRouter from "./routes/recovery.js";
import categoryRouter        from "./routes/category.js";
import projectCategoryRouter from "./routes/projectCategory.js";
import projectTypeRouter     from "./routes/projectType.js";
import specialityRouter      from "./routes/speciality.js";
import applicationRouter     from "./routes/application.js";
import productCategoryRouter    from "./routes/productCategory.js";
import productSubcategoryRouter from "./routes/productSubcategory.js";
import designSubcategoryRouter  from "./routes/designSubcategory.js";
import materialRouter from "./routes/material.js";
import finishRouter   from "./routes/finish.js";
import cityRouter     from "./routes/city.js";
import financeClientRouter   from "./routes/financeClient.js";
import financeVendorRouter   from "./routes/financeVendor.js";
import financeEmployeeRouter from "./routes/financeEmployee.js";
import financeMaterialRouter from "./routes/financeMaterial.js";
import financeTeamRouter     from "./routes/financeTeam.js";
import financeSettingRouter  from "./routes/financeSetting.js";
import financeProjectRouter      from "./routes/financeProject.js";
import financeWorkTypeRateRouter from "./routes/financeWorkTypeRate.js";
import financeTeamRateRouter     from "./routes/financeTeamRate.js";
import financeWorkRouter           from "./routes/financeWork.js";
import financeWorkTeamAssignmentRouter from "./routes/financeWorkTeamAssignment.js";
import financeMeasurementRouter    from "./routes/financeMeasurement.js";
import financeStockMovementRouter  from "./routes/financeStockMovement.js";
import financeRunningBillRouter    from "./routes/financeRunningBill.js";
import financeReceiptRouter        from "./routes/financeReceipt.js";
import financeReceivableRouter     from "./routes/financeReceivable.js";
import financeContractorAdvanceRouter   from "./routes/financeContractorAdvance.js";
import financeContractorDeductionRouter from "./routes/financeContractorDeduction.js";
import financeContractorPaymentRouter   from "./routes/financeContractorPayment.js";
import financeContractorLedgerRouter    from "./routes/financeContractorLedger.js";
import financePurchaseRouter      from "./routes/financePurchase.js";
import financeVendorPaymentRouter from "./routes/financeVendorPayment.js";
import financeVendorLedgerRouter  from "./routes/financeVendorLedger.js";
import financeBankAccountRouter  from "./routes/financeBankAccount.js";
import financeBankTransferRouter from "./routes/financeBankTransfer.js";
import financeCashEntryRouter    from "./routes/financeCashEntry.js";
import financeCashBookRouter     from "./routes/financeCashBook.js";
import financeSalaryPaymentRouter   from "./routes/financeSalaryPayment.js";
import financeSalaryLedgerRouter    from "./routes/financeSalaryLedger.js";
import financeCommissionPaymentRouter from "./routes/financeCommissionPayment.js";
import financeCommissionLedgerRouter  from "./routes/financeCommissionLedger.js";
import financeExpenseRouter         from "./routes/financeExpense.js";
import financeReportsRouter         from "./routes/financeReports.js";
import financeDailyLabourRouter          from "./routes/financeDailyLabour.js";
import financeSupervisorAttendanceRouter from "./routes/financeSupervisorAttendance.js";
import financeSupervisorIncentiveRouter  from "./routes/financeSupervisorIncentive.js";
import financeSupervisorLabourPaymentRouter from "./routes/financeSupervisorLabourPayment.js";
import financeSupervisorRouter               from "./routes/financeSupervisor.js";
import financeCompanySettingsRouter      from "./routes/financeCompanySettings.js";
import financeActivityLogRouter          from "./routes/financeActivityLog.js";
import dotenv from 'dotenv';
import { wss } from './middlewares/webSocket.js'; // Import WebSocket server setup

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// CORS — manual headers, guaranteed to work
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// Connect to the database
connectDB(process.env.MONGO_URI);

// Rate limiting — public submission endpoints only
const submissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 10,                     // max 10 submissions per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
});
app.use('/api/appointment/add',      submissionLimiter);
app.use('/api/appointment/quote',    submissionLimiter);
app.use('/api/requests/submit',      submissionLimiter);

// Routes
app.use('/api/design', designRouter);
app.use('/api/project', projectRouter);
app.use('/api/product',   productRouter);
app.use('/api/requests',     requestsRouter);
app.use('/api/testimonial',  testimonialRouter);
app.use('/api/appointment', router);
app.use('/api/admin', admin);
app.use('/api/user', user);
app.use('/api/recovery', recoveryRouter);
app.use('/api/category',         categoryRouter);
app.use('/api/project-category', projectCategoryRouter);
app.use('/api/project-type',     projectTypeRouter);
app.use('/api/speciality',       specialityRouter);
app.use('/api/application',      applicationRouter);
app.use('/api/product-category',    productCategoryRouter);
app.use('/api/product-subcategory', productSubcategoryRouter);
app.use('/api/design-subcategory',  designSubcategoryRouter);
app.use('/api/material', materialRouter);
app.use('/api/finish',   finishRouter);
app.use('/api/city',     cityRouter);
app.use('/api/finance/clients',   financeClientRouter);
app.use('/api/finance/vendors',   financeVendorRouter);
app.use('/api/finance/vendors',   financeVendorLedgerRouter); // same prefix, separate ledger concern — see routes/financeVendorLedger.js
app.use('/api/finance/vendors',   financeCommissionLedgerRouter); // same prefix, separate ledger concern — see routes/financeCommissionLedger.js
app.use('/api/finance/employees', financeEmployeeRouter);
app.use('/api/finance/employees', financeSalaryLedgerRouter); // same prefix, separate ledger concern — see routes/financeSalaryLedger.js
app.use('/api/finance/materials', financeMaterialRouter);
app.use('/api/finance/teams',     financeTeamRouter);
app.use('/api/finance/settings',  financeSettingRouter);
app.use('/api/finance/settings',  financeCompanySettingsRouter); // same prefix, separate concern — see routes/financeCompanySettings.js
app.use('/api/finance/projects',        financeProjectRouter);
app.use('/api/finance/work-type-rates', financeWorkTypeRateRouter);
app.use('/api/finance/team-rates',      financeTeamRateRouter);
app.use('/api/finance/works',           financeWorkRouter);
app.use('/api/finance/work-team-assignments', financeWorkTeamAssignmentRouter);
app.use('/api/finance/measurements',    financeMeasurementRouter);
app.use('/api/finance/stock-movements', financeStockMovementRouter);
app.use('/api/finance/running-bills',   financeRunningBillRouter);
app.use('/api/finance/receipts',        financeReceiptRouter);
app.use('/api/finance/receivables',     financeReceivableRouter);
app.use('/api/finance/contractor-advances',   financeContractorAdvanceRouter);
app.use('/api/finance/contractor-deductions', financeContractorDeductionRouter);
app.use('/api/finance/contractor-payments',   financeContractorPaymentRouter);
app.use('/api/finance/contractors',           financeContractorLedgerRouter);
app.use('/api/finance/purchases',       financePurchaseRouter);
app.use('/api/finance/vendor-payments', financeVendorPaymentRouter);
app.use('/api/finance/bank-accounts',   financeBankAccountRouter);
app.use('/api/finance/bank-transfers',  financeBankTransferRouter);
app.use('/api/finance/cash-entries',    financeCashEntryRouter);
app.use('/api/finance/cash-book',       financeCashBookRouter);
app.use('/api/finance/salary-payments',     financeSalaryPaymentRouter);
app.use('/api/finance/commission-payments', financeCommissionPaymentRouter);
app.use('/api/finance/expenses',            financeExpenseRouter);
app.use('/api/finance/reports',             financeReportsRouter);
app.use('/api/finance/daily-labour',            financeDailyLabourRouter);
app.use('/api/finance/supervisor-attendance',   financeSupervisorAttendanceRouter);
app.use('/api/finance/supervisor-incentives',   financeSupervisorIncentiveRouter);
app.use('/api/finance/supervisor-labour-payments', financeSupervisorLabourPaymentRouter);
app.use('/api/finance/supervisors',                financeSupervisorRouter);
app.use('/api/finance/activity',                financeActivityLogRouter);

// Serve static files
app.use('/images', express.static('uploads'));

// Root route
app.get("/", (req, res) => {
    res.send("API Working");
});

// Create an HTTP server to allow WebSocket connections
const server = http.createServer(app);

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// Start the server
server.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
