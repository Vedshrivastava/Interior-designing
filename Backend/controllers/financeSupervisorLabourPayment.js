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

        // engineerApproved: true is a hard gate here, not just a UI filter —
        // an unapproved ("neglected") entry can't be settled even if its id
        // is passed directly, so the supervisor's payment is always cut to
        // exactly what's been verified done.
        const entries = await FinanceDailyLabour.find({
            _id: { $in: coveredDailyLabourIds }, supervisorId, engineerApproved: true, settledInPaymentId: null, deleted: { $ne: true },
        });
        if (entries.length !== coveredDailyLabourIds.length) {
            return res.status(400).json({ success: false, message: 'Some selected entries are invalid, not yet engineer-approved, already settled, or do not belong to this supervisor' });
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

// Payable only counts engineer-approved, unsettled entries — unapproved
// ("neglected") ones are reported separately and excluded, cutting the
// supervisor's payable total accordingly (same gate addSupervisorLabourPayment
// enforces server-side).
const getLabourPayable = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const agg = await FinanceDailyLabour.aggregate([
            { $match: { supervisorId: new mongoose.Types.ObjectId(employeeId), settledInPaymentId: null, deleted: { $ne: true } } },
            // $ifNull — aggregation bypasses Mongoose's schema default, so
            // entries logged before engineerApproved existed have the field
            // missing entirely (not false); without this they'd silently
            // fall into neither bucket instead of "neglected".
            { $group: { _id: { $ifNull: ['$engineerApproved', false] }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]);
        const approved = agg.find(a => a._id === true) || { total: 0, count: 0 };
        const neglected = agg.find(a => a._id === false) || { total: 0, count: 0 };
        res.json({
            success: true,
            data: {
                payable: approved.total, unsettledCount: approved.count,
                neglected: neglected.total, neglectedCount: neglected.count,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error computing labour payable' });
    }
};

export { listSupervisorLabourPayments, addSupervisorLabourPayment, removeSupervisorLabourPayment, getLabourPayable };
