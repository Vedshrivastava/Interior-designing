import mongoose from 'mongoose';
import FinanceSupervisorLabourPayment from '../models/financeSupervisorLabourPayment.js';
import FinanceDailyLabour from '../models/financeDailyLabour.js';
import FinanceEmployee from '../models/financeEmployee.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listSupervisorLabourPayments = async (req, res) => {
    try {
        const { supervisorId } = req.query;
        if (!supervisorId) return res.status(400).json({ success: false, message: 'supervisorId is required' });
        const items = await FinanceSupervisorLabourPayment.find({ supervisorId, deleted: { $ne: true } })
            .populate('bankAccountId', 'accountName')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching labour settlements' });
    }
};

// One bulk payment covering many financeDailyLabour entries — earnings were
// already counted as cost when each entry was logged; this only settles the
// cash side and marks those entries as paid.
const addSupervisorLabourPayment = async (req, res) => {
    try {
        const { supervisorId, coveredDailyLabourIds, date, paymentMode, bankOrCashLabel, bankAccountId, utrNumber, notes } = req.body;
        if (!supervisorId) return res.status(400).json({ success: false, message: 'Supervisor is required' });
        if (!Array.isArray(coveredDailyLabourIds) || coveredDailyLabourIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Select at least one daily labour entry' });
        }
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const entries = await FinanceDailyLabour.find({
            _id: { $in: coveredDailyLabourIds }, supervisorId, settledInPaymentId: null, deleted: { $ne: true },
        });
        if (entries.length !== coveredDailyLabourIds.length) {
            return res.status(400).json({ success: false, message: 'Some selected entries are invalid, already settled, or do not belong to this supervisor' });
        }

        const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

        const item = new FinanceSupervisorLabourPayment({
            supervisorId, coveredDailyLabourIds, totalAmount, date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null,
            utrNumber: utrNumber || '', notes: notes || '',
        });
        await item.save();

        await FinanceDailyLabour.updateMany({ _id: { $in: coveredDailyLabourIds } }, { settledInPaymentId: item._id });

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: totalAmount,
                reason: 'Labour settlement', relatedSupervisorLabourPaymentId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        }

        broadcast({ type: 'financeSupervisorLabourPaymentsChanged', supervisorId });
        broadcast({ type: 'financeDailyLabourChanged' });

        const supervisor = await FinanceEmployee.findById(supervisorId).select('name');
        await logActivity({
            eventType: 'labour_settlement_paid',
            entityType: 'financeSupervisorLabourPayment',
            entityId: item._id,
            summary: `Labour settlement of ₹${totalAmount} paid to ${supervisor?.name || 'supervisor'}, covering ${entries.length} entries.`,
            amount: totalAmount,
            req,
        });

        res.json({ success: true, message: 'Settlement recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording settlement' });
    }
};

const removeSupervisorLabourPayment = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceSupervisorLabourPayment.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();

        await FinanceDailyLabour.updateMany({ settledInPaymentId: item._id }, { settledInPaymentId: null });
        await FinanceCashEntry.updateMany(
            { relatedSupervisorLabourPaymentId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );

        broadcast({ type: 'financeSupervisorLabourPaymentsChanged', supervisorId: item.supervisorId });
        broadcast({ type: 'financeCashBookChanged' });
        broadcast({ type: 'financeDailyLabourChanged' });
        res.json({ success: true, message: 'Settlement removed — entries are unsettled again' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing settlement' });
    }
};

const getLabourPayable = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const agg = await FinanceDailyLabour.aggregate([
            { $match: { supervisorId: new mongoose.Types.ObjectId(employeeId), settledInPaymentId: null, deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]);
        res.json({ success: true, data: { payable: agg[0]?.total || 0, unsettledCount: agg[0]?.count || 0 } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing labour payable' });
    }
};

export { listSupervisorLabourPayments, addSupervisorLabourPayment, removeSupervisorLabourPayment, getLabourPayable };
