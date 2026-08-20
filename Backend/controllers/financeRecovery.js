import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import FinanceClient from '../models/financeClient.js';
import FinanceClientContact from '../models/financeClientContact.js';
import FinanceVendor from '../models/financeVendor.js';
import FinanceReferral from '../models/financeReferral.js';
import FinanceLabourProvider from '../models/financeLabourProvider.js';
import FinanceEmployee from '../models/financeEmployee.js';
import FinanceMaterial from '../models/financeMaterial.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceBankAccount from '../models/financeBankAccount.js';
import FinanceBankEntry from '../models/financeBankEntry.js';
import FinanceBankTransfer from '../models/financeBankTransfer.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import FinanceProject from '../models/financeProject.js';
import FinanceWork from '../models/financeWork.js';
import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import FinanceContractorRate from '../models/financeContractorRate.js';
import FinanceLabourRate from '../models/financeLabourRate.js';
import FinanceWorkContractorAssignment from '../models/financeWorkContractorAssignment.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import FinanceRunningBill from '../models/financeRunningBill.js';
import FinancePurchase from '../models/financePurchase.js';
import FinanceStockMovement from '../models/financeStockMovement.js';
import FinanceReceipt from '../models/financeReceipt.js';
import FinanceClientQuotation from '../models/financeClientQuotation.js';
import FinanceClientDirectPayment from '../models/financeClientDirectPayment.js';
import FinanceContractorAdvance from '../models/financeContractorAdvance.js';
import FinanceContractorDeduction from '../models/financeContractorDeduction.js';
import FinanceContractorPayment from '../models/financeContractorPayment.js';
import FinanceLabourAdvance from '../models/financeLabourAdvance.js';
import FinanceLabourDeduction from '../models/financeLabourDeduction.js';
import FinanceLabourPayment from '../models/financeLabourPayment.js';
import FinanceLabourProviderPayment from '../models/financeLabourProviderPayment.js';
import FinanceVendorPayment from '../models/financeVendorPayment.js';
import FinanceCommissionPayment from '../models/financeCommissionPayment.js';
import FinanceSalaryPayment from '../models/financeSalaryPayment.js';
import FinanceExpense from '../models/financeExpense.js';
import FinanceExpensePayment from '../models/financeExpensePayment.js';
import FinanceSupervisorAttendance from '../models/financeSupervisorAttendance.js';
import FinanceSupervisorDeduction from '../models/financeSupervisorDeduction.js';
import FinanceSupervisorIncentive from '../models/financeSupervisorIncentive.js';
import FinanceGstFiling from '../models/financeGstFiling.js';
import FinanceTdsDeposit from '../models/financeTdsDeposit.js';
import FinanceSetting from '../models/financeSetting.js';
import FinanceSiteDiary from '../models/financeSiteDiary.js';
import FinanceProjectPhoto from '../models/financeProjectPhoto.js';
import FinanceClientDocument from '../models/financeClientDocument.js';
import FinanceProjectDocument from '../models/financeProjectDocument.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

dotenv.config();
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key:    process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

// Small display helpers shared by the name() functions below — every
// soft-deleted transaction here reduces to "how much, when" at a glance,
// so a consistent ₹/date format across ~40 entity types beats each one
// inventing its own.
const inr = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const dfmt = d => d ? new Date(d).toLocaleDateString('en-IN') : '';
const moneyDate = d => `${inr(d.amount)} — ${dfmt(d.date)}`;

/*
 * Finance's own Recovery Bin — deliberately separate from the main
 * dashboard's (/api/recovery, controllers/recovery.js), which only ever
 * covers the public-site content models (Design/Product/Project/
 * Category/etc.).
 *
 * Every finance model that soft-deletes (deleted/deletedAt/deletedBy) is
 * covered here — originally only the 14 entities whose own delete
 * confirmation told the admin "moved to Recovery Bin" were wired in;
 * everything else soft-deleted the same way underneath but had no
 * self-service restore path, so a lost payment/advance/deduction/rate/etc.
 * was recoverable only by someone hand-editing the database. Restore is
 * uniformly "flip deleted back to false" with no side effects to reverse
 * (every downstream figure that cares is computed fresh from `deleted` at
 * read time, same anti-drift convention as the rest of this module).
 *
 * Deliberately NOT covered:
 *   - financeCompanySettings — a singleton (getOrCreate pattern), never
 *     has a delete action against it.
 *   - financeTeam / financeTeamRate / financeWorkTeamAssignment —
 *     superseded by financeContractorRate (rate now lives on the vendor
 *     directly); no live UI creates or deletes these anymore.
 * Work assignments (contractor/labour) additionally exclude rows with
 * deletedReason: 'project_completed' — those are auto-released when a
 * project is marked completed and have their own reactivation-aware
 * restore path (financeProject.js's reopenFinanceProject, which
 * re-checks labourer availability before restoring); surfacing them here
 * too would flood the bin with routine state, not lost data, and a blind
 * restore could double-book a labourer reopenFinanceProject would have
 * caught.
 */
const RECOVERY_TYPES = {
    client:         { model: FinanceClient,         label: 'Client',          changed: 'financeClientsChanged',         name: d => d.name },
    clientContact:  { model: FinanceClientContact,  label: 'Client Contact',  changed: 'financeClientContactsChanged',  name: d => d.name },
    vendor:         { model: FinanceVendor,          label: 'Vendor',          changed: 'financeVendorsChanged',         name: d => d.name },
    referral:       { model: FinanceReferral,        label: 'Referral',        changed: 'financeReferralsChanged',       name: d => d.name },
    labourProvider: { model: FinanceLabourProvider,  label: 'Labour Provider', changed: 'financeLabourProvidersChanged', name: d => d.name },
    employee:       { model: FinanceEmployee,        label: 'Employee',        changed: 'financeEmployeesChanged',       name: d => d.name },
    material:       { model: FinanceMaterial,        label: 'Material',        changed: 'financeMaterialsChanged',       name: d => d.name },
    labourer:       { model: FinanceLabourer,        label: 'Labourer',        changed: 'financeLabourersChanged',       name: d => d.name },
    bankAccount:    { model: FinanceBankAccount,     label: 'Bank Account',    changed: 'financeBankAccountsChanged',    name: d => d.accountName },
    bankEntry:      { model: FinanceBankEntry,       label: 'Bank Entry',      changed: 'financeBankAccountsChanged',    name: d => `${d.type === 'in' ? 'Deposit' : 'Withdrawal'} — ${moneyDate(d)}` },
    bankTransfer:   { model: FinanceBankTransfer,    label: 'Bank Transfer',   changed: 'financeBankAccountsChanged',    name: d => `Transfer — ${moneyDate(d)}` },
    cashEntry:      { model: FinanceCashEntry,       label: 'Cash Entry',      changed: 'financeCashBookChanged',        name: d => `${d.type === 'in' ? 'Cash In' : 'Cash Out'} — ${moneyDate(d)}` },
    project:        { model: FinanceProject,         label: 'Project',         changed: 'financeProjectsChanged',        name: d => d.name },
    work:           { model: FinanceWork,            label: 'Work',            changed: 'financeWorksChanged',           name: d => d.workType },
    workTypeRate:      { model: FinanceWorkTypeRate,      label: 'Work Type Rate',    changed: 'financeWorkTypeRatesChanged',   name: d => `${d.workType} — ${inr(d.clientRatePerSqft)}/unit` },
    contractorRate:    { model: FinanceContractorRate,    label: 'Contractor Rate',   changed: 'financeContractorRatesChanged', name: d => `${d.workType} — ${inr(d.ratePerSqft)}/unit` },
    labourRate:        { model: FinanceLabourRate,        label: 'Labour Rate',       changed: 'financeLabourRatesChanged',     name: d => `${d.workType} — ${inr(d.ratePerSqft)}/unit` },
    workContractorAssignment: { model: FinanceWorkContractorAssignment, label: 'Contractor Assignment', changed: 'financeWorkContractorAssignmentsChanged', name: () => 'Contractor Assignment', extraFilter: { deletedReason: { $ne: 'project_completed' } } },
    workLabourAssignment:     { model: FinanceWorkLabourAssignment,     label: 'Labour Assignment',     changed: 'financeWorkLabourAssignmentsChanged',     name: () => 'Labour Assignment',     extraFilter: { deletedReason: { $ne: 'project_completed' } } },
    measurement:        { model: FinanceMeasurement,       label: 'Contractor Measurement', changed: 'financeMeasurementsChanged',        name: d => `Measurement — ${dfmt(d.date)}` },
    labourMeasurement:  { model: FinanceLabourMeasurement, label: 'Labour Measurement',      changed: 'financeLabourMeasurementsChanged',  name: d => `Measurement — ${dfmt(d.date)}` },
    runningBill:    { model: FinanceRunningBill,     label: 'Running Bill',    changed: 'financeRunningBillsChanged',    name: d => `Bill #${d.billNumber}` },
    purchase:       { model: FinancePurchase,        label: 'Purchase',        changed: 'financePurchasesChanged',       name: d => `${d.transactionType === 'return' ? 'Return' : 'Purchase'} — ${d.quantity ?? ''}`.trim() },
    stockMovement:  { model: FinanceStockMovement,   label: 'Stock Movement',  changed: 'financeStockChanged',           name: d => `${d.movementType} — ${dfmt(d.date)}` },
    receipt:        { model: FinanceReceipt,         label: 'Receipt',         changed: 'financeCashBookChanged',        name: d => d.receiptNumber ? `Receipt #${d.receiptNumber} — ${inr(d.amount)}` : moneyDate({ amount: d.amount, date: d.receiptDate }) },
    clientQuotation:      { model: FinanceClientQuotation,      label: 'Client Quotation',        changed: 'financeClientQuotationsChanged', name: d => `Quotation #${d.quotationNumber} — ${inr(d.amount)}` },
    clientDirectPayment:  { model: FinanceClientDirectPayment,  label: 'Client Direct Payment',    changed: 'clientDirectPaymentsChanged',    name: d => moneyDate(d) },
    contractorAdvance:    { model: FinanceContractorAdvance,    label: 'Contractor Advance',       changed: 'financeCashBookChanged',         name: d => moneyDate(d) },
    contractorDeduction:  { model: FinanceContractorDeduction,  label: 'Contractor Deduction',     changed: 'financeContractorLedgerChanged', name: d => `${inr(d.amount)} — ${d.reason}` },
    contractorPayment:    { model: FinanceContractorPayment,    label: 'Contractor Payment',       changed: 'financeCashBookChanged',         name: d => moneyDate(d) },
    labourAdvance:        { model: FinanceLabourAdvance,        label: 'Labour Advance',           changed: 'financeCashBookChanged',         name: d => moneyDate(d) },
    labourDeduction:      { model: FinanceLabourDeduction,      label: 'Labour Deduction',         changed: 'financeLabourLedgerChanged',     name: d => `${inr(d.amount)} — ${d.reason}` },
    labourPayment:        { model: FinanceLabourPayment,        label: 'Labour Payment',           changed: 'financeCashBookChanged',         name: d => moneyDate(d) },
    labourProviderPayment: { model: FinanceLabourProviderPayment, label: 'Labour Provider Payment', changed: 'financeCashBookChanged',       name: d => moneyDate(d) },
    vendorPayment:        { model: FinanceVendorPayment,        label: 'Vendor Payment',           changed: 'financeCashBookChanged',         name: d => moneyDate(d) },
    commissionPayment:    { model: FinanceCommissionPayment,    label: 'Commission Payment',       changed: 'financeCashBookChanged',         name: d => moneyDate(d) },
    salaryPayment:        { model: FinanceSalaryPayment,        label: 'Salary Payment',           changed: 'financeCashBookChanged',         name: d => `${d.month} — ${inr(d.amount)}` },
    expense:              { model: FinanceExpense,              label: 'Expense',                  changed: 'financeCashBookChanged',         name: d => d.expenseCategory ? `${d.expenseCategory} — ${inr(d.amount)}` : moneyDate(d) },
    expensePayment:       { model: FinanceExpensePayment,       label: 'Expense Payment',          changed: 'financeCashBookChanged',         name: d => moneyDate(d) },
    supervisorAttendance: { model: FinanceSupervisorAttendance, label: 'Supervisor Attendance',     changed: 'financeSupervisorAttendanceChanged', name: d => `${d.status} — ${dfmt(d.date)}` },
    supervisorDeduction:  { model: FinanceSupervisorDeduction,  label: 'Supervisor Deduction',      changed: 'financeSupervisorDeductionsChanged', name: d => `${inr(d.amount)} — ${d.reason}` },
    supervisorIncentive:  { model: FinanceSupervisorIncentive,  label: 'Supervisor Incentive',      changed: 'financeCashBookChanged',             name: d => `${inr(d.amount)} — ${d.reason}` },
    gstFiling:      { model: FinanceGstFiling,       label: 'GST Filing',      changed: 'financeGstFilingsChanged',      name: d => d.month },
    tdsDeposit:     { model: FinanceTdsDeposit,      label: 'TDS Deposit',     changed: 'financeCashBookChanged',        name: d => d.challanNumber ? `Challan ${d.challanNumber} — ${inr(d.amount)}` : moneyDate(d) },
    setting:        { model: FinanceSetting,         label: 'Setting',        changed: 'financeSettingsChanged',        name: d => d.name },
    siteDiary:      { model: FinanceSiteDiary,       label: 'Site Diary Entry', changed: 'financeSiteDiaryChanged',      name: d => (d.note || '').slice(0, 60) },
    projectPhoto:   { model: FinanceProjectPhoto,    label: 'Project Photo',   changed: 'financeProjectPhotosChanged',   name: d => d.caption || 'Photo' },
    clientDocument:  { model: FinanceClientDocument,  label: 'Client Document',  changed: 'financeClientDocumentsChanged',  name: d => d.name, fileField: 'fileUrl', folder: 'client_documents' },
    projectDocument: { model: FinanceProjectDocument, label: 'Project Document', changed: 'financeProjectDocumentsChanged', name: d => d.name, fileField: 'fileUrl', folder: 'project_documents' },
};

const POPULATE_BY_TYPE = {
    clientContact: [{ path: 'clientId', select: 'name' }],
    bankEntry: [{ path: 'bankAccountId', select: 'accountName' }, { path: 'projectId', select: 'name' }],
    bankTransfer: [{ path: 'fromAccountId', select: 'accountName' }, { path: 'toAccountId', select: 'accountName' }],
    cashEntry: [{ path: 'projectId', select: 'name' }],
    project: [{ path: 'clientId', select: 'name' }],
    work: [{ path: 'projectId', select: 'name' }],
    workTypeRate: [{ path: 'projectId', select: 'name' }],
    contractorRate: [{ path: 'projectId', select: 'name' }, { path: 'contractorVendorId', select: 'name' }],
    labourRate: [{ path: 'projectId', select: 'name' }, { path: 'labourerId', select: 'name' }],
    workContractorAssignment: [{ path: 'workId', select: 'workType projectId' }, { path: 'contractorVendorId', select: 'name' }],
    workLabourAssignment: [{ path: 'workId', select: 'workType projectId' }, { path: 'labourerId', select: 'name' }],
    measurement: [{ path: 'workId', select: 'workType' }, { path: 'projectId', select: 'name' }, { path: 'contractorVendorId', select: 'name' }],
    labourMeasurement: [{ path: 'workId', select: 'workType' }, { path: 'projectId', select: 'name' }, { path: 'labourerId', select: 'name' }],
    runningBill: [{ path: 'projectId', select: 'name' }],
    purchase: [{ path: 'projectId', select: 'name' }, { path: 'vendorId', select: 'name' }, { path: 'materialId', select: 'name' }],
    stockMovement: [{ path: 'projectId', select: 'name' }, { path: 'materialId', select: 'name' }],
    receipt: [{ path: 'clientId', select: 'name' }, { path: 'projectId', select: 'name' }],
    clientQuotation: [{ path: 'projectId', select: 'name' }],
    clientDirectPayment: [{ path: 'projectId', select: 'name' }, { path: 'workId', select: 'workType' }],
    contractorAdvance: [{ path: 'vendorId', select: 'name' }, { path: 'projectId', select: 'name' }],
    contractorDeduction: [{ path: 'vendorId', select: 'name' }, { path: 'projectId', select: 'name' }],
    contractorPayment: [{ path: 'vendorId', select: 'name' }, { path: 'projectId', select: 'name' }],
    labourAdvance: [{ path: 'labourerId', select: 'name' }, { path: 'projectId', select: 'name' }],
    labourDeduction: [{ path: 'labourerId', select: 'name' }, { path: 'projectId', select: 'name' }],
    labourPayment: [{ path: 'labourerId', select: 'name' }, { path: 'projectId', select: 'name' }],
    labourProviderPayment: [{ path: 'labourProviderId', select: 'name' }, { path: 'projectId', select: 'name' }],
    vendorPayment: [{ path: 'vendorId', select: 'name' }, { path: 'projectId', select: 'name' }],
    commissionPayment: [{ path: 'referralId', select: 'name' }, { path: 'projectId', select: 'name' }],
    salaryPayment: [{ path: 'employeeId', select: 'name' }],
    expense: [{ path: 'projectId', select: 'name' }],
    expensePayment: [{ path: 'expenseId', select: 'expenseCategory amount' }],
    supervisorAttendance: [{ path: 'employeeId', select: 'name' }],
    supervisorDeduction: [{ path: 'employeeId', select: 'name' }, { path: 'projectId', select: 'name' }],
    supervisorIncentive: [{ path: 'employeeId', select: 'name' }, { path: 'projectId', select: 'name' }],
    tdsDeposit: [{ path: 'tdsSectionId', select: 'name' }],
    siteDiary: [{ path: 'projectId', select: 'name' }],
    projectPhoto: [{ path: 'projectId', select: 'name' }],
    clientDocument: [{ path: 'clientId', select: 'name' }],
    projectDocument: [{ path: 'projectId', select: 'name' }],
};

const listFinanceBin = async (req, res) => {
    try {
        // Fixed fetch order; the Recovery Bin UI re-sorts client-side (by
        // date or name, either direction) so this doesn't need to change.
        const entries = await Promise.all(
            Object.entries(RECOVERY_TYPES).map(async ([_type, cfg]) => {
                let query = cfg.model.find({ deleted: true, ...(cfg.extraFilter || {}) }).sort({ deletedAt: -1 });
                for (const p of POPULATE_BY_TYPE[_type] || []) query = query.populate(p);
                const docs = await query;
                return [_type, docs.map(d => ({ ...d.toObject(), _type, _displayName: cfg.name(d) }))];
            })
        );
        res.json({ success: true, data: Object.fromEntries(entries) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching finance recovery bin' });
    }
};

const restoreFinanceItem = async (req, res) => {
    try {
        const { _id, _type } = req.body;
        const cfg = RECOVERY_TYPES[_type];
        if (!cfg) return res.status(400).json({ success: false, message: 'Unknown item type' });

        const item = await cfg.model.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.deleted = false;
        item.deletedAt = undefined;
        item.deletedBy = undefined;
        if (item.deletedReason !== undefined) item.deletedReason = '';
        await item.save();

        // Purchases cascade-soft-delete their stock movements on remove
        // (financePurchase.js's removePurchase) — restore the same way,
        // so a restored purchase doesn't leave its stock movement stranded.
        if (_type === 'purchase') {
            await FinanceStockMovement.updateMany(
                { relatedPurchaseId: item._id },
                { deleted: false, $unset: { deletedAt: '', deletedBy: '' } }
            );
            broadcast({ type: 'financeStockChanged', projectId: item.projectId });
        }

        broadcast({ type: 'binChanged' });
        broadcast({ type: cfg.changed });

        // One call here covers restore for every type this Recovery Bin
        // handles — Recent Activity used to only ever show the original
        // "created" entry for these, so a delete-then-restore cycle left no
        // trace, reading like the item had simply always been there (or,
        // worse, like a second one had appeared if it was recreated instead
        // of restored). See the matching *_deleted logActivity calls added
        // alongside each entity's own soft-delete for the other half of this.
        await logActivity({
            eventType: `${_type}_restored`,
            entityType: cfg.model.modelName,
            entityId: item._id,
            projectId: item.projectId || null,
            summary: `${cfg.label} "${cfg.name(item)}" restored`,
            entityNames: [cfg.name(item)],
            req,
        });

        res.json({ success: true, message: `"${cfg.name(item)}" restored` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error restoring item' });
    }
};

const permanentDeleteFinanceItem = async (req, res) => {
    try {
        const { _id, _type } = req.body;
        const cfg = RECOVERY_TYPES[_type];
        if (!cfg) return res.status(400).json({ success: false, message: 'Unknown item type' });

        const item = await cfg.model.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        if (cfg.fileField && item[cfg.fileField]) {
            try {
                const publicId = item[cfg.fileField].split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`${cfg.folder}/${publicId}`, { resource_type: 'auto' });
            } catch (err) {
                console.error('Cloudinary delete error:', err);
            }
        }

        await cfg.model.findByIdAndDelete(_id);
        broadcast({ type: 'binChanged' });
        broadcast({ type: cfg.changed });

        await logActivity({
            eventType: `${_type}_permanently_deleted`,
            entityType: cfg.model.modelName,
            entityId: item._id,
            projectId: item.projectId || null,
            summary: `${cfg.label} "${cfg.name(item)}" permanently deleted`,
            entityNames: [cfg.name(item)],
            req,
        });

        res.json({ success: true, message: `"${cfg.name(item)}" permanently deleted` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error permanently deleting item' });
    }
};

export { listFinanceBin, restoreFinanceItem, permanentDeleteFinanceItem };
