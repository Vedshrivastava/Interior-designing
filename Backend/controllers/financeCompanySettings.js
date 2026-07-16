import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import archiver from 'archiver';
import dotenv from 'dotenv';
import FinanceCompanySettings from '../models/financeCompanySettings.js';
import FinanceMaterial from '../models/financeMaterial.js';
import FinanceStockMovement from '../models/financeStockMovement.js';
import FinanceProject from '../models/financeProject.js';
import FinanceRunningBill from '../models/financeRunningBill.js';
import FinanceReceipt from '../models/financeReceipt.js';
import FinanceClient from '../models/financeClient.js';
import FinanceVendor from '../models/financeVendor.js';
import FinanceWork from '../models/financeWork.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinancePurchase from '../models/financePurchase.js';
import FinanceContractorAdvance from '../models/financeContractorAdvance.js';
import FinanceContractorDeduction from '../models/financeContractorDeduction.js';
import FinanceContractorPayment from '../models/financeContractorPayment.js';
import FinanceVendorPayment from '../models/financeVendorPayment.js';
import FinanceBankAccount from '../models/financeBankAccount.js';
import FinanceBankTransfer from '../models/financeBankTransfer.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import FinanceSalaryPayment from '../models/financeSalaryPayment.js';
import FinanceCommissionPayment from '../models/financeCommissionPayment.js';
import FinanceExpense from '../models/financeExpense.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceLabourRate from '../models/financeLabourRate.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import FinanceLabourAdvance from '../models/financeLabourAdvance.js';
import FinanceLabourDeduction from '../models/financeLabourDeduction.js';
import FinanceLabourPayment from '../models/financeLabourPayment.js';
import FinanceSupervisorAttendance from '../models/financeSupervisorAttendance.js';
import FinanceSupervisorIncentive from '../models/financeSupervisorIncentive.js';
import FinanceSupervisorDeduction from '../models/financeSupervisorDeduction.js';
import FinanceSetting from '../models/financeSetting.js';
import userModel from '../models/user.js';
import { sendFinanceAlertEmail } from '../middlewares/emails.js';

dotenv.config();
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

// Singleton accessor — creates the one document with schema defaults on
// first read if it doesn't exist yet. Every other function here goes
// through this, never a direct `find`.
const getOrCreateSingleton = async () => {
    let doc = await FinanceCompanySettings.findOne({ deleted: { $ne: true } });
    if (!doc) doc = await FinanceCompanySettings.create({});
    return doc;
};

const uploadLogo = async (file) => {
    if (!file) return null;
    try {
        const result = await cloudinary.uploader.upload(file.path, { folder: 'finance_company_logo' });
        fs.unlinkSync(file.path);
        return result.secure_url;
    } catch (uploadError) {
        console.error('Error uploading logo:', uploadError);
        return null;
    }
};

const getCompanySettings = async (req, res) => {
    try {
        const doc = await getOrCreateSingleton();
        res.json({ success: true, data: doc });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching company settings' });
    }
};

// One shared update path for every Settings tab whose fields live on this
// singleton (Company, Financial Year, GST, Notifications, PDF Templates) —
// only the keys actually present in the request body are applied, so one
// tab's save never clobbers another tab's fields.
const UPDATABLE_FIELDS = [
    'companyName', 'address', 'gstin', 'pan', 'letterheadFooterText', 'accentColor',
    'defaultGstRate', 'fyStartMonth', 'notificationEmails',
    'lowStockAlertEnabled', 'overdueReceivableAlertEnabled', 'overdueReceivableDays',
];

const updateCompanySettings = async (req, res) => {
    try {
        const doc = await getOrCreateSingleton();
        const update = {};
        for (const key of UPDATABLE_FIELDS) {
            if (req.body[key] !== undefined) update[key] = req.body[key];
        }
        if (update.notificationEmails && typeof update.notificationEmails === 'string') {
            update.notificationEmails = JSON.parse(update.notificationEmails);
        }
        if (req.file) {
            const logoUrl = await uploadLogo(req.file);
            if (logoUrl) update.logoUrl = logoUrl;
        }
        const updated = await FinanceCompanySettings.findByIdAndUpdate(doc._id, update, { new: true });
        res.json({ success: true, message: 'Settings updated', data: updated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating company settings' });
    }
};

// Notifications tab is the exact same singleton document as Company/FY/GST —
// these two handlers are thin aliases kept separate only so the frontend
// has a matching route per tab; there is no second data source here.
const getNotificationSettings = getCompanySettings;
const updateNotificationSettings = updateCompanySettings;

// Same query shape as controllers/admin.js's listAdmins — just projecting
// one more field (allowedFinanceModules) that endpoint doesn't need.
const getPermissions = async (req, res) => {
    try {
        const admins = await userModel.find({ role: 'ADMIN' }, 'name email allowedFinanceModules createdAt').sort({ createdAt: -1 });
        res.json({ success: true, data: admins });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching permissions' });
    }
};

// allowedFinanceModules: null/omitted clears the restriction (full access,
// same as an unset field) — an empty array [] is a real restriction to
// zero modules, so those two are deliberately not treated the same.
const updatePermissions = async (req, res) => {
    try {
        const { userId, allowedFinanceModules } = req.body;
        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.role !== 'ADMIN') return res.status(400).json({ success: false, message: 'Permissions only apply to ADMIN users — MASTER always has full access' });

        if (allowedFinanceModules === null || allowedFinanceModules === undefined) {
            user.allowedFinanceModules = undefined;
        } else {
            user.allowedFinanceModules = allowedFinanceModules;
        }
        await user.save();
        res.json({ success: true, message: `${user.name}'s finance module access updated`, data: user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating permissions' });
    }
};

/*
 * No cron infrastructure exists in this codebase — this is check-on-load,
 * called from the Dashboard, not a scheduler. De-duplication is
 * timestamp-based (lastNotifiedAt, checked against a 24h window) rather
 * than a separate "alerts sent" log.
 *
 * INTERPRETATION FLAG: minimumStockLevel lives on financeMaterial (one
 * number per material), but stock itself is tracked per project (site) —
 * see financeStockMovement's own schema comment. A material can be
 * short at one site while fine at another, so this checks every
 * (project, material) pair against the material's one threshold and
 * flags the material as low if ANY project is short — de-duping via the
 * single financeMaterial.lastNotifiedAt the spec asks for, not a
 * per-project timestamp. The alert email lists which project(s) triggered it.
 */
const NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const checkLowStock = async (settings) => {
    if (!settings.lowStockAlertEnabled) return { checked: 0, notified: 0 };
    const materials = await FinanceMaterial.find({ deleted: { $ne: true } });
    const projects = await FinanceProject.find({ deleted: { $ne: true } });
    if (materials.length === 0 || projects.length === 0) return { checked: materials.length, notified: 0 };

    const rows = await FinanceStockMovement.aggregate([
        { $match: { deleted: { $ne: true } } },
        {
            $group: {
                _id: { projectId: '$projectId', materialId: '$materialId' },
                dump:     { $sum: { $cond: [{ $eq: ['$movementType', 'dump'] }, '$quantity', 0] } },
                consume:  { $sum: { $cond: [{ $eq: ['$movementType', 'consume'] }, '$quantity', 0] } },
                returned: { $sum: { $cond: [{ $eq: ['$movementType', 'return'] }, '$quantity', 0] } },
                waste:    { $sum: { $cond: [{ $eq: ['$movementType', 'waste'] }, '$quantity', 0] } },
            },
        },
    ]);

    const projectNameById = new Map(projects.map(p => [p._id.toString(), p.name]));
    const lowByMaterial = new Map(); // materialId -> [{projectName, currentStock}]
    for (const row of rows) {
        const materialId = row._id.materialId.toString();
        const projectId = row._id.projectId.toString();
        const projectName = projectNameById.get(projectId);
        if (!projectName) continue; // deleted project — skip
        const currentStock = row.dump - row.consume - row.returned - row.waste;
        const material = materials.find(m => m._id.toString() === materialId);
        if (!material) continue;
        if (currentStock < material.minimumStockLevel) {
            if (!lowByMaterial.has(materialId)) lowByMaterial.set(materialId, []);
            lowByMaterial.get(materialId).push({ projectName, currentStock, minimumStockLevel: material.minimumStockLevel });
        }
    }

    let notified = 0;
    const now = Date.now();
    for (const [materialId, hits] of lowByMaterial) {
        const material = materials.find(m => m._id.toString() === materialId);
        if (material.lastNotifiedAt && (now - new Date(material.lastNotifiedAt).getTime()) < NOTIFY_COOLDOWN_MS) continue;

        const rowsHtml = hits.map(h => `<li>${h.projectName}: ${h.currentStock} ${material.unit} (minimum ${h.minimumStockLevel} ${material.unit})</li>`).join('');
        await sendFinanceAlertEmail(
            settings.notificationEmails,
            `Low stock alert — ${material.name}`,
            `<p><b>${material.name}</b> is below its minimum stock level on the following project(s):</p><ul>${rowsHtml}</ul>`
        ).catch(err => console.error('Low stock alert email failed:', err));

        material.lastNotifiedAt = new Date();
        await material.save();
        notified += 1;
    }
    return { checked: lowByMaterial.size, notified };
};

const checkOverdueReceivables = async (settings) => {
    if (!settings.overdueReceivableAlertEnabled) return { checked: 0, notified: 0 };
    // Advance-contract projects bill via Running Bills too, once work starts.
    const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material', 'advance'];
    const projects = await FinanceProject.find({ deleted: { $ne: true }, contractType: { $in: BILLABLE_CONTRACT_TYPES } }).populate('clientId', 'name');

    let checked = 0;
    let notified = 0;
    const now = Date.now();
    const thresholdMs = settings.overdueReceivableDays * 24 * 60 * 60 * 1000;

    for (const project of projects) {
        const issuedBills = await FinanceRunningBill.find({ projectId: project._id, status: 'issued', deleted: { $ne: true } }).sort({ billDate: 1 });
        if (issuedBills.length === 0) continue;
        const issuedTotal = issuedBills.reduce((sum, b) => sum + b.totalAmount, 0);
        const receipts = await FinanceReceipt.find({ projectId: project._id, deleted: { $ne: true } });
        const receivedTotal = receipts.reduce((sum, r) => sum + r.amount, 0);
        const balance = issuedTotal - receivedTotal;
        if (balance <= 0) continue;

        const oldestBill = issuedBills[0];
        const ageMs = now - new Date(oldestBill.billDate).getTime();
        if (ageMs < thresholdMs) continue;
        checked += 1;

        if (oldestBill.lastNotifiedAt && (now - new Date(oldestBill.lastNotifiedAt).getTime()) < NOTIFY_COOLDOWN_MS) continue;

        await sendFinanceAlertEmail(
            settings.notificationEmails,
            `Overdue receivable — ${project.name}`,
            `<p><b>${project.name}</b> (${project.clientId?.name || 'client'}) has an outstanding balance of ₹${balance.toLocaleString('en-IN')}, oldest unpaid bill #${oldestBill.billNumber} dated ${new Date(oldestBill.billDate).toLocaleDateString('en-IN')} (over ${settings.overdueReceivableDays} days old).</p>`
        ).catch(err => console.error('Overdue receivable alert email failed:', err));

        oldestBill.lastNotifiedAt = new Date();
        await oldestBill.save();
        notified += 1;
    }
    return { checked, notified };
};

const checkAlerts = async (req, res) => {
    try {
        const settings = await getOrCreateSingleton();
        const [lowStock, overdue] = await Promise.all([
            checkLowStock(settings),
            checkOverdueReceivables(settings),
        ]);
        res.json({ success: true, data: { lowStock, overdue } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error checking alerts' });
    }
};

// One JSON file per finance collection, zipped and streamed directly —
// nothing written to disk. Soft-deleted records excluded unless
// ?includeDeleted=true is passed.
const BACKUP_COLLECTIONS = [
    { name: 'financeClients', model: FinanceClient },
    { name: 'financeVendors', model: FinanceVendor },
    { name: 'financeProjects', model: FinanceProject },
    { name: 'financeWorks', model: FinanceWork },
    { name: 'financeMeasurements', model: FinanceMeasurement },
    { name: 'financeStockMovements', model: FinanceStockMovement },
    { name: 'financeRunningBills', model: FinanceRunningBill },
    { name: 'financeReceipts', model: FinanceReceipt },
    { name: 'financeContractorAdvances', model: FinanceContractorAdvance },
    { name: 'financeContractorDeductions', model: FinanceContractorDeduction },
    { name: 'financeContractorPayments', model: FinanceContractorPayment },
    { name: 'financePurchases', model: FinancePurchase },
    { name: 'financeVendorPayments', model: FinanceVendorPayment },
    { name: 'financeBankAccounts', model: FinanceBankAccount },
    { name: 'financeBankTransfers', model: FinanceBankTransfer },
    { name: 'financeCashEntries', model: FinanceCashEntry },
    { name: 'financeSalaryPayments', model: FinanceSalaryPayment },
    { name: 'financeCommissionPayments', model: FinanceCommissionPayment },
    { name: 'financeExpenses', model: FinanceExpense },
    { name: 'financeLabourers', model: FinanceLabourer },
    { name: 'financeLabourRates', model: FinanceLabourRate },
    { name: 'financeWorkLabourAssignments', model: FinanceWorkLabourAssignment },
    { name: 'financeLabourMeasurements', model: FinanceLabourMeasurement },
    { name: 'financeLabourAdvances', model: FinanceLabourAdvance },
    { name: 'financeLabourDeductions', model: FinanceLabourDeduction },
    { name: 'financeLabourPayments', model: FinanceLabourPayment },
    { name: 'financeSupervisorAttendances', model: FinanceSupervisorAttendance },
    { name: 'financeSupervisorIncentives', model: FinanceSupervisorIncentive },
    { name: 'financeSupervisorDeductions', model: FinanceSupervisorDeduction },
    { name: 'financeSettings', model: FinanceSetting },
    { name: 'financeCompanySettings', model: FinanceCompanySettings },
];

const exportBackup = async (req, res) => {
    try {
        const includeDeleted = req.query.includeDeleted === 'true';
        const filter = includeDeleted ? {} : { deleted: { $ne: true } };

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="finance-backup-${new Date().toISOString().slice(0, 10)}.zip"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => { throw err; });
        archive.pipe(res);

        for (const { name, model } of BACKUP_COLLECTIONS) {
            const docs = await model.find(filter).lean();
            archive.append(JSON.stringify(docs, null, 2), { name: `${name}.json` });
        }

        await archive.finalize();
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Error exporting backup' });
    }
};

export {
    getCompanySettings, updateCompanySettings,
    getNotificationSettings, updateNotificationSettings,
    getPermissions, updatePermissions,
    checkAlerts, exportBackup,
};
