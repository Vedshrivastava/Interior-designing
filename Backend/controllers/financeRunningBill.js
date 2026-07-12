import FinanceRunningBill from '../models/financeRunningBill.js';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import FinanceProject from '../models/financeProject.js';
import { broadcast } from '../middlewares/webSocket.js';

const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material'];

const listRunningBills = async (req, res) => {
    try {
        const { projectId, status } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const filter = { projectId, deleted: { $ne: true } };
        if (status) filter.status = status;
        const items = await FinanceRunningBill.find(filter).sort({ billDate: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching running bills' });
    }
};

/*
 * Shared by generate() and preview() so the UI's "preview line items before
 * confirming" step and the actual generation can never compute different
 * numbers. Pulls approved, unbilled measurements in the date range, groups
 * by work, and snapshots the current financeWorkTypeRate per work type.
 * Throws with a plain message on any validation failure — callers turn
 * that into a 400.
 */
const computeBillLineItems = async (projectId, periodFrom, periodTo) => {
    const project = await FinanceProject.findById(projectId);
    if (!project) throw new Error('Project not found');
    if (!BILLABLE_CONTRACT_TYPES.includes(project.contractType)) {
        throw new Error("Advance-contract projects don't use Running Bills — they track payment via the advance fields instead");
    }

    const measurements = await FinanceMeasurement.find({
        projectId,
        deleted: { $ne: true },
        engineerApproved: true,
        billedInRunningBillId: null,
        date: { $gte: new Date(periodFrom), $lte: new Date(periodTo) },
    }).populate('workId', 'workType');

    if (measurements.length === 0) {
        throw new Error('No approved, unbilled measurements in this date range');
    }

    // Group by work
    const byWork = new Map();
    for (const m of measurements) {
        if (!m.workId) continue; // orphaned reference — skip defensively
        const key = m.workId._id.toString();
        if (!byWork.has(key)) byWork.set(key, { workId: m.workId._id, workType: m.workId.workType, areaBilledSqft: 0, measurementIds: [] });
        const entry = byWork.get(key);
        entry.areaBilledSqft += m.areaCoveredSqft;
        entry.measurementIds.push(m._id);
    }

    const workTypes = [...new Set([...byWork.values()].map(e => e.workType))];
    const rates = await FinanceWorkTypeRate.find({ projectId, workType: { $in: workTypes }, deleted: { $ne: true } });
    const rateByWorkType = new Map(rates.map(r => [r.workType, r]));

    const missingRates = workTypes.filter(wt => !rateByWorkType.has(wt));
    if (missingRates.length > 0) {
        throw new Error(`No client rate configured for: ${missingRates.join(', ')} — add a Work Type Rate first`);
    }

    const lineItems = [...byWork.values()].map(entry => {
        const rate = rateByWorkType.get(entry.workType);
        return {
            workId: entry.workId,
            workType: entry.workType,
            areaBilledSqft: entry.areaBilledSqft,
            clientRatePerSqft: rate.clientRatePerSqft,
            amount: entry.areaBilledSqft * rate.clientRatePerSqft,
        };
    });

    const totalAmount = lineItems.reduce((sum, li) => sum + li.amount, 0);
    const measurementIds = measurements.map(m => m._id);

    return { lineItems, totalAmount, measurementIds };
};

const previewRunningBill = async (req, res) => {
    try {
        const { projectId, periodFrom, periodTo } = req.query;
        if (!projectId || !periodFrom || !periodTo) {
            return res.status(400).json({ success: false, message: 'projectId, periodFrom, and periodTo are required' });
        }
        const { lineItems, totalAmount } = await computeBillLineItems(projectId, periodFrom, periodTo);
        res.json({ success: true, data: { lineItems, totalAmount } });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

const generateRunningBill = async (req, res) => {
    try {
        const { projectId, periodFrom, periodTo, billDate } = req.body;
        if (!projectId || !periodFrom || !periodTo) {
            return res.status(400).json({ success: false, message: 'projectId, periodFrom, and periodTo are required' });
        }

        const { lineItems, totalAmount, measurementIds } = await computeBillLineItems(projectId, periodFrom, periodTo);

        const billCount = await FinanceRunningBill.countDocuments({ projectId });
        const billNumber = String(billCount + 1);

        const bill = new FinanceRunningBill({
            projectId, billNumber,
            billDate: billDate || new Date(),
            periodFrom, periodTo,
            lineItems, totalAmount,
            status: 'draft',
        });
        await bill.save();

        await FinanceMeasurement.updateMany(
            { _id: { $in: measurementIds } },
            { billedInRunningBillId: bill._id }
        );

        broadcast({ type: 'financeRunningBillsChanged', projectId });
        res.json({ success: true, message: `Bill #${billNumber} generated`, data: bill });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error generating bill' });
    }
};

const updateRunningBillStatus = async (req, res) => {
    try {
        const { _id, status } = req.body;
        if (!['draft', 'issued'].includes(status)) {
            return res.status(400).json({ success: false, message: 'status must be draft or issued' });
        }
        const item = await FinanceRunningBill.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.status = status;
        await item.save();
        broadcast({ type: 'financeRunningBillsChanged', projectId: item.projectId });
        res.json({ success: true, message: 'Bill status updated', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating bill status' });
    }
};

// Unlike removeMeasurement/removeWork (which leave their downstream effects
// as historical artifacts on delete), removing a bill DOES reverse its one
// effect: it clears billedInRunningBillId on every measurement it consumed.
// Without that, those measurements would be permanently stuck "billed" to a
// deleted bill and could never be billed again — a real dead end, not just
// a stale record.
const removeRunningBill = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceRunningBill.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceMeasurement.updateMany({ billedInRunningBillId: item._id }, { billedInRunningBillId: null });

        broadcast({ type: 'financeRunningBillsChanged', projectId: item.projectId });
        res.json({ success: true, message: `Bill #${item.billNumber} moved to recovery bin — its measurements are billable again` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing bill' });
    }
};

export { listRunningBills, previewRunningBill, generateRunningBill, updateRunningBillStatus, removeRunningBill };
