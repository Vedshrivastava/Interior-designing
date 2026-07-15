import FinanceDailyLabour from '../models/financeDailyLabour.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import FinanceProject from '../models/financeProject.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

// half_day = 0.5×rate, full_day = 1×rate, extra_day = 1.5×rate — per the
// build spec. Adjust here only if the real convention turns out different;
// this is the one place the multiplier lives.
const MULTIPLIER = { half_day: 0.5, full_day: 1, extra_day: 1.5 };

const listDailyLabour = async (req, res) => {
    try {
        const { projectId, supervisorId, dateFrom, dateTo, unsettledOnly } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        if (supervisorId) filter.supervisorId = supervisorId;
        if (unsettledOnly === 'true') filter.settledInPaymentId = null;
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) filter.date.$gte = new Date(dateFrom);
            if (dateTo) filter.date.$lte = new Date(dateTo);
        }
        const items = await FinanceDailyLabour.find(filter)
            .populate('projectId', 'name')
            .populate('supervisorId', 'name')
            .populate('bankAccountId', 'accountName')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching daily labour' });
    }
};

// amount is computed and frozen here — never accepted from the request
// body directly, same "server owns the money math" rule as Running Bill
// line items and Purchase totalAmount.
const addDailyLabour = async (req, res) => {
    try {
        const { projectId, date, labourerName, attendanceType, rate, supervisorId, paymentMode, bankOrCashLabel, bankAccountId, notes } = req.body;
        if (!projectId) return res.status(400).json({ success: false, message: 'Project is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
        if (!labourerName || !labourerName.trim()) return res.status(400).json({ success: false, message: 'Labourer name is required' });
        if (!MULTIPLIER[attendanceType]) return res.status(400).json({ success: false, message: 'attendanceType must be half_day, full_day, or extra_day' });
        if (!rate || Number(rate) <= 0) return res.status(400).json({ success: false, message: 'Rate must be greater than zero' });

        // Payment fields are deprecated on this model — a supervisor's
        // accumulated entries get paid in one bulk settlement (see
        // financeSupervisorLabourPayment), not per entry, so no cash
        // movement happens here at all. This is a cost record only; it's
        // still counted in Project Profit's Daily Labour Cost immediately,
        // same as before — only the cash-timing moved to settlement.
        const amount = Number(rate) * MULTIPLIER[attendanceType];
        const item = new FinanceDailyLabour({
            projectId, date, labourerName: labourerName.trim(), attendanceType, rate: Number(rate), amount,
            supervisorId: supervisorId || null,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null,
            notes: notes || '',
        });
        await item.save();

        broadcast({ type: 'financeDailyLabourChanged', projectId });

        const project = await FinanceProject.findById(projectId).select('name');
        await logActivity({
            eventType: 'daily_labour_logged',
            entityType: 'financeDailyLabour',
            entityId: item._id,
            projectId,
            summary: `${labourerName.trim()} recorded as ${attendanceType} at ${project?.name || 'project'} — ₹${amount}`,
            amount,
            req,
        });

        res.json({ success: true, message: 'Daily labour recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording daily labour' });
    }
};

// Grid entry — several labourers × several days submitted in one call.
// Each entry still becomes its own financeDailyLabour row with its own
// frozen amount, exactly as if it had been added one at a time through
// addDailyLabour; batching only changes how many requests the UI needs to
// make, not the shape of what gets stored.
const batchAddDailyLabour = async (req, res) => {
    try {
        const { entries } = req.body;
        if (!Array.isArray(entries) || !entries.length) {
            return res.status(400).json({ success: false, message: 'At least one entry is required' });
        }

        const labourerIds = [...new Set(entries.map(e => e.labourerId).filter(Boolean))];
        const labourers = await FinanceLabourer.find({ _id: { $in: labourerIds }, deleted: { $ne: true } });
        const labourerById = new Map(labourers.map(l => [l._id.toString(), l]));

        const docs = [];
        for (const [i, e] of entries.entries()) {
            const { projectId, date, labourerId, attendanceType, rate, supervisorId, notes } = e;
            if (!projectId) return res.status(400).json({ success: false, message: `Entry ${i + 1}: project is required` });
            if (!date) return res.status(400).json({ success: false, message: `Entry ${i + 1}: date is required` });
            if (!labourerId || !labourerById.has(labourerId)) {
                return res.status(400).json({ success: false, message: `Entry ${i + 1}: a valid roster labourer is required` });
            }
            if (!MULTIPLIER[attendanceType]) return res.status(400).json({ success: false, message: `Entry ${i + 1}: attendanceType must be half_day, full_day, or extra_day` });
            if (!rate || Number(rate) <= 0) return res.status(400).json({ success: false, message: `Entry ${i + 1}: rate must be greater than zero` });

            const labourer = labourerById.get(labourerId);
            docs.push({
                projectId, date, labourerId, labourerName: labourer.name,
                attendanceType, rate: Number(rate), amount: Number(rate) * MULTIPLIER[attendanceType],
                supervisorId: supervisorId || labourer.supervisorId || null,
                notes: notes || '',
            });
        }

        const created = await FinanceDailyLabour.insertMany(docs);

        const projectIds = [...new Set(docs.map(d => d.projectId.toString()))];
        for (const projectId of projectIds) broadcast({ type: 'financeDailyLabourChanged', projectId });

        const projects = await FinanceProject.find({ _id: { $in: projectIds } }).select('name');
        const projectNameById = new Map(projects.map(p => [p._id.toString(), p.name]));
        await Promise.all(created.map(item => logActivity({
            eventType: 'daily_labour_logged',
            entityType: 'financeDailyLabour',
            entityId: item._id,
            projectId: item.projectId,
            summary: `${item.labourerName} recorded as ${item.attendanceType} at ${projectNameById.get(item.projectId.toString()) || 'project'} — ₹${item.amount} (batch entry)`,
            amount: item.amount,
            req,
        })));

        res.json({ success: true, message: `${created.length} daily labour entries recorded`, data: created });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording batch daily labour' });
    }
};

// Toggle engineer approval on one entry — same shape as
// financeMeasurement's updateMeasurement approval branch. Settled entries
// can still be toggled (a settlement already happened before verification
// caught up); it only affects future settlement totals, not this one.
const approveDailyLabour = async (req, res) => {
    try {
        const { _id, engineerApproved } = req.body;
        if (typeof engineerApproved !== 'boolean') return res.status(400).json({ success: false, message: 'engineerApproved must be true or false' });
        const item = await FinanceDailyLabour.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.engineerApproved = engineerApproved;
        item.engineerApprovedAt = engineerApproved ? new Date() : null;
        item.engineerApprovedBy = engineerApproved ? (req.userName || 'Admin') : '';
        await item.save();

        broadcast({ type: 'financeDailyLabourChanged', projectId: item.projectId });
        res.json({ success: true, message: engineerApproved ? 'Entry approved' : 'Approval revoked', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating approval' });
    }
};

const removeDailyLabour = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceDailyLabour.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        if (item.settledInPaymentId) {
            return res.status(400).json({ success: false, message: 'This entry is already settled — remove the settlement instead' });
        }
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        // Legacy — old entries created before settlement existed may still
        // carry their own cash entry; new entries never do.
        await FinanceCashEntry.updateMany(
            { relatedDailyLabourId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeDailyLabourChanged', projectId: item.projectId });
        broadcast({ type: 'financeCashBookChanged' });
        res.json({ success: true, message: 'Daily labour entry removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing daily labour entry' });
    }
};

export { listDailyLabour, addDailyLabour, batchAddDailyLabour, approveDailyLabour, removeDailyLabour };
