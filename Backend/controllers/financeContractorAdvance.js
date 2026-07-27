import FinanceContractorAdvance from '../models/financeContractorAdvance.js';
import FinanceCashEntry from '../models/financeCashEntry.js';
import { assertContractorVendor } from '../utils/contractorVendor.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listContractorAdvances = async (req, res) => {
    try {
        const { vendorId, projectId } = req.query;
        if (!vendorId && !projectId) return res.status(400).json({ success: false, message: 'vendorId or projectId is required' });
        const filter = { deleted: { $ne: true } };
        if (vendorId) filter.vendorId = vendorId;
        if (projectId) filter.projectId = projectId;
        const items = await FinanceContractorAdvance.find(filter).sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching advances' });
    }
};

// BUG FIX: an advance is real cash handed to the contractor right now
// (Balance Payable already treats it exactly like a Payment — see
// financeContractorLedger.js's own comment) — it used to never touch the
// Cash Book or a bank account at all, so giving a cash advance silently
// left Cash in Hand overstated, and a bank-mode advance never showed up
// in that account's activity/balance. Mirrors addContractorPayment's own
// cash-entry automation (minus TDS — advances aren't withheld against).
const addContractorAdvance = async (req, res) => {
    try {
        const { vendorId, projectId, amount, date, paymentMode, bankOrCashLabel, bankAccountId, utrNumber, notes } = req.body;
        if (!vendorId) return res.status(400).json({ success: false, message: 'Vendor is required' });
        const vendor = await assertContractorVendor(vendorId);
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const item = new FinanceContractorAdvance({
            vendorId, projectId: projectId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', bankAccountId: bankAccountId || null, utrNumber: utrNumber || '', notes: notes || '',
        });
        await item.save();

        if (!bankAccountId) {
            await FinanceCashEntry.create({
                date, type: 'out', amount: Number(amount), projectId: projectId || null,
                reason: 'Contractor advance', relatedContractorAdvanceId: item._id, notes: notes || '',
            });
            broadcast({ type: 'financeCashBookChanged' });
        } else {
            broadcast({ type: 'financeBankAccountsChanged' });
        }

        broadcast({ type: 'financeContractorLedgerChanged', vendorId });

        await logActivity({
            eventType: 'contractor_advance_given',
            entityType: 'financeContractorAdvance',
            entityId: item._id,
            projectId: projectId || null,
            summary: `Advance given to contractor ${vendor.name}`,
            entityNames: [vendor.name],
            amount: Number(amount),
            req,
        });

        res.json({ success: true, message: 'Advance recorded', data: item });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error recording advance' });
    }
};

const updateContractorAdvance = async (req, res) => {
    try {
        const { _id, projectId, amount, date, paymentMode, bankOrCashLabel, utrNumber, notes } = req.body;
        const existing = await FinanceContractorAdvance.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        await FinanceContractorAdvance.findByIdAndUpdate(_id, {
            projectId: projectId || null, amount: Number(amount), date,
            paymentMode: paymentMode || '', bankOrCashLabel: bankOrCashLabel || '', utrNumber: utrNumber || '', notes: notes || '',
        });
        broadcast({ type: 'financeContractorLedgerChanged', vendorId: existing.vendorId });
        res.json({ success: true, message: 'Advance updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating advance' });
    }
};

const removeContractorAdvance = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceContractorAdvance.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceCashEntry.updateMany(
            { relatedContractorAdvanceId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );
        broadcast({ type: 'financeContractorLedgerChanged', vendorId: item.vendorId });
        broadcast({ type: 'financeCashBookChanged' });
        if (item.bankAccountId) broadcast({ type: 'financeBankAccountsChanged' });
        res.json({ success: true, message: 'Advance removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing advance' });
    }
};

export { listContractorAdvances, addContractorAdvance, updateContractorAdvance, removeContractorAdvance };
