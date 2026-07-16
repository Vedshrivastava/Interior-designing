import FinanceClientQuotation from '../models/financeClientQuotation.js';
import FinanceProject from '../models/financeProject.js';
import FinanceProjectDocument from '../models/financeProjectDocument.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const STATUS_LABEL = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' };

// projectId is the only supported filter — same shape as
// GET /running-bills/list. A client's rollup view fetches its own project
// list first, then calls this once per project (see ClientDetail.jsx),
// rather than this endpoint supporting a clientId filter itself.
//
// Each quotation's uploaded original-file(s) live in financeProjectDocument
// (tagged with quotationId) rather than on this document itself, so the
// same upload also shows up untouched in the Project's own Documents tab.
// Joined in here so neither the Project Quotations manager nor the
// Client's read-only rollup needs a second round trip per quotation.
const listClientQuotations = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const items = await FinanceClientQuotation.find({ projectId, deleted: { $ne: true } }).sort({ date: -1, createdAt: -1 }).lean();

        const quotationIds = items.map(q => q._id);
        const docs = quotationIds.length
            ? await FinanceProjectDocument.find({ quotationId: { $in: quotationIds }, deleted: { $ne: true } }).sort({ createdAt: -1 }).lean()
            : [];
        const docsByQuotation = new Map();
        for (const d of docs) {
            const key = d.quotationId.toString();
            if (!docsByQuotation.has(key)) docsByQuotation.set(key, []);
            docsByQuotation.get(key).push(d);
        }

        const data = items.map(q => ({ ...q, documents: docsByQuotation.get(q._id.toString()) || [] }));
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching quotations' });
    }
};

const addClientQuotation = async (req, res) => {
    try {
        const { projectId, date, amount, notes } = req.body;
        if (!projectId) return res.status(400).json({ success: false, message: 'Project is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
        if (amount === undefined || amount === '') return res.status(400).json({ success: false, message: 'Amount is required' });

        const project = await FinanceProject.findById(projectId).populate('clientId', 'name');
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        const count = await FinanceClientQuotation.countDocuments({ projectId });
        const quotationNumber = String(count + 1);

        const item = new FinanceClientQuotation({
            projectId, quotationNumber, date, amount, notes,
        });
        await item.save();

        broadcast({ type: 'financeClientQuotationsChanged', projectId });
        await logActivity({
            eventType: 'client_quotation_issued', entityType: 'financeClientQuotation', entityId: item._id,
            projectId,
            summary: `Quotation #${quotationNumber} issued for ${project.name} (${project.clientId?.name || 'client'}) — ₹${amount}`,
            amount, req,
        });

        res.json({ success: true, message: 'Quotation added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding quotation' });
    }
};

const updateClientQuotationStatus = async (req, res) => {
    try {
        const { _id, status } = req.body;
        if (!['pending', 'accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }
        const item = await FinanceClientQuotation.findById(_id).populate('projectId', 'name');
        if (!item) return res.status(404).json({ success: false, message: 'Quotation not found' });

        item.status = status;
        await item.save();

        broadcast({ type: 'financeClientQuotationsChanged', projectId: item.projectId?._id });
        await logActivity({
            eventType: 'client_quotation_status_changed', entityType: 'financeClientQuotation', entityId: item._id,
            projectId: item.projectId?._id,
            summary: `Quotation #${item.quotationNumber} for ${item.projectId?.name || 'project'} marked ${STATUS_LABEL[status]}`,
            req,
        });

        res.json({ success: true, message: `Quotation marked ${STATUS_LABEL[status]}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating quotation status' });
    }
};

const removeClientQuotation = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceClientQuotation.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeClientQuotationsChanged', projectId: item.projectId });
        res.json({ success: true, message: `Quotation #${item.quotationNumber} removed` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing quotation' });
    }
};

export { listClientQuotations, addClientQuotation, updateClientQuotationStatus, removeClientQuotation };
