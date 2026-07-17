import FinanceContractorDeduction from '../models/financeContractorDeduction.js';
import FinanceWork from '../models/financeWork.js';
import FinanceContractorRate from '../models/financeContractorRate.js';
import { assertContractorVendor } from '../utils/contractorVendor.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// amount is always derived here, never trusted from the client — sqft is
// the human judgment call, the rate lookup (same key every earnings
// computation in this module uses: projectId + vendorId + workType) turns
// it into ₹. Throws (caller responds 400) if no rate is configured, since
// there's no honest ₹ figure to save without one.
const resolveContractorDeductionAmount = async (workId, vendorId, areaSqft) => {
    const work = await FinanceWork.findOne({ _id: workId, deleted: { $ne: true } });
    if (!work) throw new Error('Work not found');
    const rate = await FinanceContractorRate.findOne({ projectId: work.projectId, contractorVendorId: vendorId, workType: work.workType, deleted: { $ne: true } });
    if (!rate) throw new Error(`No contractor rate configured for ${work.workType} on this project — add one before deducting`);
    return { amount: round2(areaSqft * rate.ratePerSqft), projectId: work.projectId };
};

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
        const { vendorId, workId, areaSqft, reason, date, notes } = req.body;
        if (!vendorId) return res.status(400).json({ success: false, message: 'Vendor is required' });
        const vendor = await assertContractorVendor(vendorId);
        if (!workId) return res.status(400).json({ success: false, message: 'Work is required — the deduction amount is derived from its configured rate' });
        if (!areaSqft || Number(areaSqft) <= 0) return res.status(400).json({ success: false, message: 'Sqft to deduct must be greater than zero' });
        if (!reason || !reason.trim()) return res.status(400).json({ success: false, message: 'Reason is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const { amount, projectId } = await resolveContractorDeductionAmount(workId, vendorId, Number(areaSqft));

        const item = new FinanceContractorDeduction({
            vendorId, projectId, workId, areaSqft: Number(areaSqft), amount, reason: reason.trim(), date, notes: notes || '',
        });
        await item.save();
        broadcast({ type: 'financeContractorLedgerChanged', vendorId });

        await logActivity({
            eventType: 'contractor_deduction_applied',
            entityType: 'financeContractorDeduction',
            entityId: item._id,
            projectId,
            summary: `${areaSqft} sqft (₹${amount}) deducted from ${vendor.name} — ${reason.trim()}`,
            amount,
            req,
        });

        res.json({ success: true, message: 'Deduction recorded', data: item });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error recording deduction' });
    }
};

const updateContractorDeduction = async (req, res) => {
    try {
        const { _id, workId, areaSqft, reason, date, notes } = req.body;
        const existing = await FinanceContractorDeduction.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!workId) return res.status(400).json({ success: false, message: 'Work is required — the deduction amount is derived from its configured rate' });
        if (!areaSqft || Number(areaSqft) <= 0) return res.status(400).json({ success: false, message: 'Sqft to deduct must be greater than zero' });
        if (!reason || !reason.trim()) return res.status(400).json({ success: false, message: 'Reason is required' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const { amount, projectId } = await resolveContractorDeductionAmount(workId, existing.vendorId, Number(areaSqft));

        await FinanceContractorDeduction.findByIdAndUpdate(_id, {
            projectId, workId, areaSqft: Number(areaSqft), amount, reason: reason.trim(), date, notes: notes || '',
        });
        broadcast({ type: 'financeContractorLedgerChanged', vendorId: existing.vendorId });
        res.json({ success: true, message: 'Deduction updated' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error updating deduction' });
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
