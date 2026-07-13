import FinanceSalaryPayment from '../models/financeSalaryPayment.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { broadcast } from '../middlewares/webSocket.js';

const listSalaryPayments = async (req, res) => {
    try {
        const { employeeId, month } = req.query;
        if (!employeeId) return res.status(400).json({ success: false, message: 'employeeId is required' });
        const filter = { employeeId, deleted: { $ne: true } };
        if (month) filter.month = month;
        const items = await FinanceSalaryPayment.find(filter).populate('bankAccountId', 'accountName').sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching salary payments' });
    }
};

// bankAccountId means bank (the bank statement reads it directly); no
// bankAccountId means cash — a financeCashEntry is auto-created below.
const addSalaryPayment = async (req, res) => {
    try {
        const { employeeId, month, amount, date, paymentMode, bankOrCashLabel, bankAccountId, utrNumber, notes } = req.body;
        if (!employeeId) return res.status(400).json({ success: false, message: 'Employee is required' });
        if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ success: false, message: 'A valid month (YYYY-MM) is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceSalaryPayment({
            employeeId, month, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null, utrNumber: utrNumber || '',
            notes: notes || '',
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount),
                reason: `Salary payment — ${month}`, relatedSalaryPaymentId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        }

        broadcast({ type: 'financeSalaryPaymentsChanged', employeeId });
        res.json({ success: true, message: 'Salary payment recorded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording salary payment' });
    }
};

const updateSalaryPayment = async (req, res) => {
    try {
        const { _id, month, amount, date, paymentMode, bankOrCashLabel, utrNumber, notes } = req.body;
        const existing = await FinanceSalaryPayment.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        await FinanceSalaryPayment.findByIdAndUpdate(_id, {
            month: month || existing.month, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', utrNumber: utrNumber || '', notes: notes || '',
        });
        broadcast({ type: 'financeSalaryPaymentsChanged', employeeId: existing.employeeId });
        res.json({ success: true, message: 'Salary payment updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating salary payment' });
    }
};

const removeSalaryPayment = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceSalaryPayment.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceCashEntry.updateMany(
            { relatedSalaryPaymentId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeSalaryPaymentsChanged', employeeId: item.employeeId });
        broadcast({ type: 'financeCashBookChanged' });
        res.json({ success: true, message: 'Salary payment removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing salary payment' });
    }
};

export { listSalaryPayments, addSalaryPayment, updateSalaryPayment, removeSalaryPayment };
