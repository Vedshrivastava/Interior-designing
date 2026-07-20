import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import FinanceClient from '../models/financeClient.js';
import FinanceVendor from '../models/financeVendor.js';
import FinanceEmployee from '../models/financeEmployee.js';
import FinanceMaterial from '../models/financeMaterial.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceBankAccount from '../models/financeBankAccount.js';
import FinanceProject from '../models/financeProject.js';
import FinanceWork from '../models/financeWork.js';
import FinanceRunningBill from '../models/financeRunningBill.js';
import FinancePurchase from '../models/financePurchase.js';
import FinanceStockMovement from '../models/financeStockMovement.js';
import FinanceClientDocument from '../models/financeClientDocument.js';
import FinanceProjectDocument from '../models/financeProjectDocument.js';
import { broadcast } from '../middlewares/webSocket.js';

dotenv.config();
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key:    process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

/*
 * Finance's own Recovery Bin — deliberately separate from the main
 * dashboard's (/api/recovery, controllers/recovery.js), which only ever
 * covers the public-site content models (Design/Product/Project/
 * Category/etc.). Every entity here is one that a Finance list page
 * actually tells the admin gets "moved to Recovery Bin" on delete
 * (MasterCrudTable, WorksManager, RunningBillsManager,
 * PurchaseOrReturnManager, DocumentsTab, ProjectsList) — all of them
 * already pure soft-delete (deleted/deletedAt/deletedBy), so restore is
 * uniformly "flip deleted back to false" with no side effects to reverse
 * (every downstream figure that cares is computed fresh from `deleted`
 * at read time, same anti-drift convention as the rest of this module).
 */
const RECOVERY_TYPES = {
    client:         { model: FinanceClient,         label: 'Client',          changed: 'financeClientsChanged',         name: d => d.name },
    vendor:         { model: FinanceVendor,          label: 'Vendor',          changed: 'financeVendorsChanged',         name: d => d.name },
    employee:       { model: FinanceEmployee,        label: 'Employee',        changed: 'financeEmployeesChanged',       name: d => d.name },
    material:       { model: FinanceMaterial,        label: 'Material',        changed: 'financeMaterialsChanged',       name: d => d.name },
    labourer:       { model: FinanceLabourer,        label: 'Labourer',        changed: 'financeLabourersChanged',       name: d => d.name },
    bankAccount:    { model: FinanceBankAccount,     label: 'Bank Account',    changed: 'financeBankAccountsChanged',    name: d => d.accountName },
    project:        { model: FinanceProject,         label: 'Project',         changed: 'financeProjectsChanged',        name: d => d.name },
    work:           { model: FinanceWork,            label: 'Work',            changed: 'financeWorksChanged',           name: d => d.workType },
    runningBill:    { model: FinanceRunningBill,     label: 'Running Bill',    changed: 'financeRunningBillsChanged',    name: d => `Bill #${d.billNumber}` },
    purchase:       { model: FinancePurchase,        label: 'Purchase',        changed: 'financePurchasesChanged',       name: d => `${d.transactionType === 'return' ? 'Return' : 'Purchase'} — ${d.quantity ?? ''}`.trim() },
    clientDocument:  { model: FinanceClientDocument,  label: 'Client Document',  changed: 'financeClientDocumentsChanged',  name: d => d.name, fileField: 'fileUrl', folder: 'client_documents' },
    projectDocument: { model: FinanceProjectDocument, label: 'Project Document', changed: 'financeProjectDocumentsChanged', name: d => d.name, fileField: 'fileUrl', folder: 'project_documents' },
};

const POPULATE_BY_TYPE = {
    project: [{ path: 'clientId', select: 'name' }],
    work: [{ path: 'projectId', select: 'name' }],
    runningBill: [{ path: 'projectId', select: 'name' }],
    purchase: [{ path: 'projectId', select: 'name' }, { path: 'vendorId', select: 'name' }, { path: 'materialId', select: 'name' }],
    clientDocument: [{ path: 'clientId', select: 'name' }],
    projectDocument: [{ path: 'projectId', select: 'name' }],
};

const listFinanceBin = async (req, res) => {
    try {
        const entries = await Promise.all(
            Object.entries(RECOVERY_TYPES).map(async ([_type, cfg]) => {
                let query = cfg.model.find({ deleted: true }).sort({ deletedAt: -1 });
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
        res.json({ success: true, message: `"${cfg.name(item)}" permanently deleted` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error permanently deleting item' });
    }
};

export { listFinanceBin, restoreFinanceItem, permanentDeleteFinanceItem };
