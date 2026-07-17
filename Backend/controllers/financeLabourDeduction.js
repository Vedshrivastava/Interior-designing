import FinanceLabourDeduction from '../models/financeLabourDeduction.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceSupervisorIncentive from '../models/financeSupervisorIncentive.js';
import FinanceEmployee from '../models/financeEmployee.js';
import FinanceWork from '../models/financeWork.js';
import FinanceLabourRate from '../models/financeLabourRate.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Mirrors financeContractorDeduction.js's resolveContractorDeductionAmount
// — amount is always derived here, never trusted from the client.
const resolveLabourDeductionAmount = async (workId, labourerId, areaSqft) => {
    const work = await FinanceWork.findOne({ _id: workId, deleted: { $ne: true } });
    if (!work) throw new Error('Work not found');
    const rate = await FinanceLabourRate.findOne({ projectId: work.projectId, labourerId, workType: work.workType, deleted: { $ne: true } });
    if (!rate) throw new Error(`No labour rate configured for ${work.workType} on this project — add one before deducting`);
    return { amount: round2(areaSqft * rate.ratePerSqft), projectId: work.projectId };
};

const listLabourDeductions = async (req, res) => {
    try {
        const { labourerId, projectId } = req.query;
        if (!labourerId && !projectId) return res.status(400).json({ success: false, message: 'labourerId or projectId is required' });
        const filter = { deleted: { $ne: true } };
        if (labourerId) filter.labourerId = labourerId;
        if (projectId) filter.projectId = projectId;
        const items = await FinanceLabourDeduction.find(filter).populate('supervisorId', 'name').sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching deductions' });
    }
};

/*
 * source: 'supervisor_catch' — the supervisor caught and fixed bad work
 * themselves. Requires supervisorId; this same amount is also credited to
 * that supervisor as a financeSupervisorIncentive in the same request, so
 * the transfer (out of the labourer's earnings, into the supervisor's) is
 * always recorded as one linked pair, never just one side.
 *
 * source: 'engineer_review' — a periodic (not scheduled) engineer review
 * flagged a flaw. Just the labourer-side deduction; if the supervisor is
 * also accountable, that's a separate, independently entered
 * financeSupervisorDeduction — not created automatically here.
 */
const addLabourDeduction = async (req, res) => {
    try {
        const { labourerId, workId, areaSqft, reason, date, source, supervisorId, notes } = req.body;
        if (!labourerId) return res.status(400).json({ success: false, message: 'Labourer is required' });
        const labourer = await FinanceLabourer.findOne({ _id: labourerId, deleted: { $ne: true } });
        if (!labourer) return res.status(404).json({ success: false, message: 'Labourer not found' });
        if (!workId) return res.status(400).json({ success: false, message: 'Work is required — the deduction amount is derived from its configured rate' });
        if (!areaSqft || Number(areaSqft) <= 0) return res.status(400).json({ success: false, message: 'Sqft to deduct must be greater than zero' });
        if (!reason || !reason.trim()) return res.status(400).json({ success: false, message: 'Reason is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
        if (!['supervisor_catch', 'engineer_review'].includes(source)) {
            return res.status(400).json({ success: false, message: 'source must be supervisor_catch or engineer_review' });
        }
        if (source === 'supervisor_catch' && !supervisorId) {
            return res.status(400).json({ success: false, message: 'Supervisor is required when the supervisor caught the mistake' });
        }

        const { amount, projectId } = await resolveLabourDeductionAmount(workId, labourerId, Number(areaSqft));

        const item = new FinanceLabourDeduction({
            labourerId, projectId, workId, areaSqft: Number(areaSqft), amount, reason: reason.trim(), date,
            source, supervisorId: source === 'supervisor_catch' ? supervisorId : null, notes: notes || '',
        });
        await item.save();
        broadcast({ type: 'financeLabourLedgerChanged', labourerId });

        await logActivity({
            eventType: 'labour_deduction_applied',
            entityType: 'financeLabourDeduction',
            entityId: item._id,
            projectId,
            summary: `${areaSqft} sqft (₹${amount}) deducted from ${labourer.name} — ${reason.trim()}`,
            amount,
            req,
        });

        if (source === 'supervisor_catch') {
            const incentive = new FinanceSupervisorIncentive({
                employeeId: supervisorId, projectId, workId, amount,
                reason: `Caught and fixed: ${reason.trim()} (${labourer.name})`, date,
            });
            await incentive.save();
            broadcast({ type: 'financeSupervisorIncentivesChanged', employeeId: supervisorId });

            const supervisor = await FinanceEmployee.findById(supervisorId).select('name');
            await logActivity({
                eventType: 'supervisor_incentive_given',
                entityType: 'financeSupervisorIncentive',
                entityId: incentive._id,
                projectId,
                summary: `Incentive of ₹${amount} given to ${supervisor?.name || 'employee'} for catching ${labourer.name}'s mistake`,
                amount,
                req,
            });
        }

        res.json({ success: true, message: 'Deduction recorded', data: item });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error recording deduction' });
    }
};

const removeLabourDeduction = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceLabourDeduction.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeLabourLedgerChanged', labourerId: item.labourerId });
        res.json({ success: true, message: 'Deduction removed — note: any linked supervisor incentive was not automatically reversed, remove it separately if needed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing deduction' });
    }
};

export { listLabourDeductions, addLabourDeduction, removeLabourDeduction };
