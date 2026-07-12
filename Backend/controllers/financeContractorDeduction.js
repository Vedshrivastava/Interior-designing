import FinanceContractorDeduction from '../models/financeContractorDeduction.js';
import { assertContractorVendor } from '../utils/contractorVendor.js';
import { broadcast } from '../middlewares/webSocket.js';

const listContractorDeductions = async (req, res) => {
    try {
        const { vendorId, projectId } = req.query;
        if (!vendorId && !projectId) return res.status(400).json({ success: false, message: 'vendorId or projectId is required' });
        const filter = { deleted: { $ne: true } };
        if (vendorId) filter.vendorId = vendorId;
        if (projectId) filter.projectId = projectId;
        const items = await FinanceContractorDeduction.find(filter).sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching deductions' });
    }
};

const addContractorDeduction = async (req, res) => {
    try {
        const { vendorId, projectId, amount, reason, date, notes } = req.body;
        if (!vendorId) return res.status(400).json({ success: false, message: 'Vendor is required' });
        await assertContractorVendor(vendorId);
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!reason || !reason.trim()) return res.status(400).json({ success: false, message: 'Reason is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceContractorDeduction({
            vendorId, projectId: projectId || null, amount: Number(amount), reason: reason.trim(), date, notes: notes || '',
        });
        await item.save();
        broadcast({ type: 'financeContractorLedgerChanged', vendorId });
        res.json({ success: true, message: 'Deduction recorded', data: item });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error recording deduction' });
    }
};

const updateContractorDeduction = async (req, res) => {
    try {
        const { _id, projectId, amount, reason, date, notes } = req.body;
        const existing = await FinanceContractorDeduction.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!reason || !reason.trim()) return res.status(400).json({ success: false, message: 'Reason is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        await FinanceContractorDeduction.findByIdAndUpdate(_id, {
            projectId: projectId || null, amount: Number(amount), reason: reason.trim(), date, notes: notes || '',
        });
        broadcast({ type: 'financeContractorLedgerChanged', vendorId: existing.vendorId });
        res.json({ success: true, message: 'Deduction updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating deduction' });
    }
};

const removeContractorDeduction = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceContractorDeduction.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeContractorLedgerChanged', vendorId: item.vendorId });
        res.json({ success: true, message: 'Deduction removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing deduction' });
    }
};

export { listContractorDeductions, addContractorDeduction, updateContractorDeduction, removeContractorDeduction };
