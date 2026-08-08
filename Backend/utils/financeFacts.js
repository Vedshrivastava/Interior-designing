/*
 * ONE discoverable place to import Finance's canonical money-fact
 * functions from — the answer to "where do I get this number from" for
 * every part of the app that needs a Balance Payable, an Amount Owed,
 * what's still outstanding on a project, or what a project's Material
 * Waste is made of.
 *
 * This file doesn't compute anything itself — each function still lives
 * wherever it structurally has to (financeReports.js for the party-balance
 * formulas, since financeContractorLedger.js/financeLabourLedger.js/
 * financeVendorLedger.js already import other helpers from there with no
 * circularity risk; financeReceivable.js for the project receivable, which
 * was already correct and canonical before this file existed). It just
 * re-exports them under one roof, so a new consumer never has to go
 * hunting through 4000+ lines of financeReports.js to find "the" formula,
 * and never has a reason to write a fifth copy of one instead.
 *
 * Every function here is the SINGLE place its concept is computed —
 * everywhere else that used to independently re-derive the same formula
 * (financeContractorLedger.js, financeLabourLedger.js,
 * financeVendorLedger.js, and financeReports.js's own company-wide
 * Analysis Rows) now calls the one exported here instead. See each
 * function's own comment at its source for the specific bug this fixed
 * (in short: a party's general/untagged advance, deduction, or payment
 * used to be silently excluded whenever a ledger was scoped to one
 * project, understating what they were still owed — or, for a vendor,
 * overstating it).
 *
 *   getContractorBalance(vendorId, projectId?)   → { earnings, totalAmount,
 *     unapprovedAmount, advances, deductions, materialWasteTotal, payments,
 *     tdsTotal, holdingTotal, directPaymentTotal, balancePayable }
 *   getLabourBalance(labourerId, projectId?)     → same shape as above
 *   getVendorBalance(vendorId, projectId?)       → { purchases, returns,
 *     payments, refunds, amountOwed }
 *   getProjectReceivable(project)                → { issuedTotal,
 *     issuedSubtotal, issuedGst, receivedTotal, directPaymentCredits,
 *     balance, clientCreditBalance, issuedBillCount, oldestIssuedBillDate }
 *   getProjectMaterialWaste(projectId)           → { fromStock,
 *     fromRejection, total }
 */
import {
    computeContractorBalance as getContractorBalance,
    computeLabourBalance as getLabourBalance,
    computeVendorBalance as getVendorBalance,
    computeProjectMaterialWaste as getProjectMaterialWaste,
} from '../controllers/financeReports.js';
import { summarizeProject as getProjectReceivable } from '../controllers/financeReceivable.js';

export { getContractorBalance, getLabourBalance, getVendorBalance, getProjectReceivable, getProjectMaterialWaste };
