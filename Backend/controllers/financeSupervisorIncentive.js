import FinanceSupervisorIncentive from '../models/financeSupervisorIncentive.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { broadcast } from '../middlewares/webSocket.js';

const listSupervisorIncentives = async (req, res) => {
    try {
        const { employeeId, projectId } = req.query;
        if (!employeeId && !projectId) return res.status(400).json({ success: false, message: 'employeeId or projectId is required' });
        const filter = { deleted: { $ne: true } };
        if (employeeId) filter.employeeId = employeeId;
        if (projectId) filter.projectId = projectId;
        const items = await FinanceSupervisorIncentive.find(filter)
            .populate('bankAccountId', 'accountName')
            .populate('projectId', 'name')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching supervisor incentives' });
    }
};

// bankAccountId means bank; no bankAccountId means cash — a
// financeCashEntry is auto-created below, same pattern as every other
// payment controller in this codebase.
const addSupervisorIncentive = async (req, res) => {
    try {
        const { employeeId, projectId, amount, reason, date, paymentMode, bankOrCashLabel, bankAccountId, notes } = req.body;
        if (!employeeId) return res.status(400).json({ success: false, message: 'Employee is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!reason || !reason.trim()) return res.status(400).json({ success: false, message: 'Reason is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceSupervisorIncentive({
            employeeId, projectId: projectId || null, amount: Number(amount), reason: reason.trim(), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null,
            notes: notes || '',
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount), projectId: projectId || null,
                reason: `Supervisor incentive — ${reason.trim()}`, relatedSupervisorIncentiveId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        }

        broadcast({ type: 'financeSupervisorIncentivesChanged', employeeId });
        res.json({ success: true, message: 'Incentive recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording incentive' });
    }
};

const removeSupervisorIncentive = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceSupervisorIncentive.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceCashEntry.updateMany(
            { relatedSupervisorIncentiveId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeSupervisorIncentivesChanged', employeeId: item.employeeId });
        broadcast({ type: 'financeCashBookChanged' });
        res.json({ success: true, message: 'Incentive removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing incentive' });
    }
};

export { listSupervisorIncentives, addSupervisorIncentive, removeSupervisorIncentive };
