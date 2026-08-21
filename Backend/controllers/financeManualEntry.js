import FinanceManualEntry from '../models/financeManualEntry.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listManualEntries = async (req, res) => {
    try {
        const { projectId } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        const items = await FinanceManualEntry.find(filter)
            .populate('projectId', 'name')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching manual entries' });
    }
};

const addManualEntry = async (req, res) => {
    try {
        const { projectId, date, workDescription, partyName, partyType, amountPaid, amountChargedToClient, notes } = req.body;
        if (!projectId) return res.status(400).json({ success: false, message: 'Project is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
        if (!workDescription || !workDescription.trim()) return res.status(400).json({ success: false, message: 'What was done is required' });
        const paid = Number(amountPaid) || 0;
        const charged = Number(amountChargedToClient) || 0;
        if (paid <= 0 && charged <= 0) return res.status(400).json({ success: false, message: 'Enter an amount paid, charged to client, or both' });

        const item = new FinanceManualEntry({
            projectId, date, workDescription: workDescription.trim(),
            partyName: partyName || '',
            partyType: ['contractor', 'labour', 'vendor', 'other'].includes(partyType) ? partyType : 'other',
            amountPaid: paid, amountChargedToClient: charged,
            notes: notes || '',
        });
        await item.save();

        broadcast({ type: 'financeManualEntriesChanged', projectId });

        await logActivity({
            eventType: 'manual_entry_added',
            entityType: 'financeManualEntry',
            entityId: item._id,
            projectId,
            summary: `Manual entry logged — ${item.workDescription.slice(0, 60)}`,
            entityNames: item.partyName ? [item.partyName] : [],
            req,
        });

        res.json({ success: true, message: 'Entry logged', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error logging entry' });
    }
};

const updateManualEntry = async (req, res) => {
    try {
        const { _id, date, workDescription, partyName, partyType, amountPaid, amountChargedToClient, notes } = req.body;
        const item = await FinanceManualEntry.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        if (date !== undefined) item.date = date;
        if (workDescription !== undefined) {
            if (!workDescription.trim()) return res.status(400).json({ success: false, message: 'What was done is required' });
            item.workDescription = workDescription.trim();
        }
        if (partyName !== undefined) item.partyName = partyName;
        if (partyType !== undefined) item.partyType = ['contractor', 'labour', 'vendor', 'other'].includes(partyType) ? partyType : 'other';
        // Any change to what was actually logged invalidates a past
        // review — same "recompute against current state" rule the
        // formal Work Review Panel enforces (a new measurement added
        // after review reverts that Work to pending too).
        if (amountPaid !== undefined && Number(amountPaid) !== item.amountPaid) { item.amountPaid = Number(amountPaid) || 0; item.reviewStatus = 'pending'; item.reviewedAt = null; item.reviewedBy = ''; item.rejectionReason = ''; }
        if (amountChargedToClient !== undefined && Number(amountChargedToClient) !== item.amountChargedToClient) { item.amountChargedToClient = Number(amountChargedToClient) || 0; item.reviewStatus = 'pending'; item.reviewedAt = null; item.reviewedBy = ''; item.rejectionReason = ''; }
        if (notes !== undefined) item.notes = notes;

        if (item.amountPaid <= 0 && item.amountChargedToClient <= 0) {
            return res.status(400).json({ success: false, message: 'Enter an amount paid, charged to client, or both' });
        }
        await item.save();

        broadcast({ type: 'financeManualEntriesChanged', projectId: item.projectId });

        res.json({ success: true, message: 'Entry updated', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating entry' });
    }
};

const approveManualEntry = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceManualEntry.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.reviewStatus = 'approved';
        item.reviewedAt = new Date();
        item.reviewedBy = req.userName || 'Admin';
        item.rejectionReason = '';
        await item.save();

        broadcast({ type: 'financeManualEntriesChanged', projectId: item.projectId });

        await logActivity({
            eventType: 'manual_entry_approved',
            entityType: 'financeManualEntry',
            entityId: item._id,
            projectId: item.projectId,
            summary: `Manual entry approved — ${item.workDescription.slice(0, 60)}`,
            entityNames: item.partyName ? [item.partyName] : [],
            req,
        });

        res.json({ success: true, message: 'Entry approved', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error approving entry' });
    }
};

const rejectManualEntry = async (req, res) => {
    try {
        const { _id, rejectionReason } = req.body;
        const item = await FinanceManualEntry.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.reviewStatus = 'rejected';
        item.reviewedAt = new Date();
        item.reviewedBy = req.userName || 'Admin';
        item.rejectionReason = rejectionReason || '';
        await item.save();

        broadcast({ type: 'financeManualEntriesChanged', projectId: item.projectId });

        await logActivity({
            eventType: 'manual_entry_rejected',
            entityType: 'financeManualEntry',
            entityId: item._id,
            projectId: item.projectId,
            summary: `Manual entry rejected — ${item.workDescription.slice(0, 60)}`,
            entityNames: item.partyName ? [item.partyName] : [],
            req,
        });

        res.json({ success: true, message: 'Entry rejected', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error rejecting entry' });
    }
};

const markManualEntryPaid = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceManualEntry.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        if (item.reviewStatus !== 'approved') return res.status(400).json({ success: false, message: 'Approve this entry before marking it paid' });

        item.paymentStatus = 'paid';
        item.paidAt = new Date();
        await item.save();

        broadcast({ type: 'financeManualEntriesChanged', projectId: item.projectId });

        res.json({ success: true, message: 'Marked paid', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error marking paid' });
    }
};

const removeManualEntry = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceManualEntry.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();

        broadcast({ type: 'financeManualEntriesChanged', projectId: item.projectId });

        await logActivity({
            eventType: 'manual_entry_deleted',
            entityType: 'financeManualEntry',
            entityId: item._id,
            projectId: item.projectId,
            summary: `Manual entry deleted — ${item.workDescription.slice(0, 60)}`,
            entityNames: item.partyName ? [item.partyName] : [],
            req,
        });

        res.json({ success: true, message: 'Entry removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing entry' });
    }
};

export { listManualEntries, addManualEntry, updateManualEntry, approveManualEntry, rejectManualEntry, markManualEntryPaid, removeManualEntry };
