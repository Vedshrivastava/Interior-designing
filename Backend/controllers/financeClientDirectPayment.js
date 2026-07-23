import FinanceClientDirectPayment from '../models/financeClientDirectPayment.js';
import FinanceProject from '../models/financeProject.js';
import FinanceWork from '../models/financeWork.js';
import FinanceSetting from '../models/financeSetting.js';
import FinanceLabourer from '../models/financeLabourer.js';
import { assertContractorVendor } from '../utils/contractorVendor.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const assertCategory = async (categoryId) => {
    const category = await FinanceSetting.findOne({ _id: categoryId, settingType: 'direct_payment_category', deleted: { $ne: true } });
    if (!category) throw new Error('Direct payment category not found');
    return category;
};

const assertParty = async (partyType, partyId) => {
    if (partyType === 'contractor') return assertContractorVendor(partyId);
    const labourer = await FinanceLabourer.findOne({ _id: partyId, deleted: { $ne: true } });
    if (!labourer) throw new Error('Labourer not found');
    return labourer;
};

// Every category currently flagged with `flagField` — resolved fresh on
// every call (no caching layer anywhere in this codebase), same "computed
// on the fly" rule as everything else in the finance module.
const categoryIdsWithFlag = async (flagField) => {
    const categories = await FinanceSetting.find({ settingType: 'direct_payment_category', deleted: { $ne: true }, [flagField]: true }, '_id');
    return categories.map(c => c._id);
};

// Sum of client-direct-payment amounts for one contractor/labourer where the
// category says "cut from worker payout" — same {partyId, deleted} +
// optional projectId filter shape computeContractorAnalysisRows'/
// computeLabourAnalysisRows'/getContractorLedger's/getLabourLedger's own
// moneyFilter already uses for advances/deductions/payments. Meant to be
// folded straight into those functions' own deductionsTotal.
export const getWorkerPayoutDeductionTotal = async (partyType, partyId, projectId = null) => {
    const categoryIds = await categoryIdsWithFlag('deductFromWorkerPayout');
    if (!categoryIds.length) return 0;
    const filter = { partyType, partyId, categoryId: { $in: categoryIds }, deleted: { $ne: true } };
    if (projectId) filter.projectId = projectId;
    const rows = await FinanceClientDirectPayment.find(filter, 'amount');
    return rows.reduce((sum, r) => sum + r.amount, 0);
};

// Sum of client-direct-payment amounts for a project (or several, for the
// company-wide dashboard aggregate) where the category says "cut from
// client bill" — meant to be subtracted from summarizeProject's/
// getDashboardSummary's client receivable balance alongside receivedTotal.
export const getClientBillCreditTotal = async (projectIdOrIds) => {
    const categoryIds = await categoryIdsWithFlag('deductFromClientBill');
    if (!categoryIds.length) return 0;
    const projectFilter = Array.isArray(projectIdOrIds) ? { $in: projectIdOrIds } : projectIdOrIds;
    const rows = await FinanceClientDirectPayment.find({ projectId: projectFilter, categoryId: { $in: categoryIds }, deleted: { $ne: true } }, 'amount');
    return rows.reduce((sum, r) => sum + r.amount, 0);
};

const listClientDirectPayments = async (req, res) => {
    try {
        const { projectId, workId, partyType, partyId } = req.query;
        if (!projectId && !workId && !(partyType && partyId)) {
            return res.status(400).json({ success: false, message: 'projectId, workId, or partyType+partyId is required' });
        }
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        if (workId) filter.workId = workId;
        if (partyType) filter.partyType = partyType;
        if (partyId) filter.partyId = partyId;
        const items = await FinanceClientDirectPayment.find(filter)
            .populate('projectId', 'name')
            .populate('workId', 'workType')
            .populate('categoryId', 'name deductFromClientBill deductFromWorkerPayout')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching client direct payments' });
    }
};

const addClientDirectPayment = async (req, res) => {
    try {
        const { projectId, workId, partyType, partyId, categoryId, amount, date, notes } = req.body;
        if (!projectId) return res.status(400).json({ success: false, message: 'Project is required' });
        if (!workId) return res.status(400).json({ success: false, message: 'Work is required' });
        if (!['contractor', 'labour'].includes(partyType)) return res.status(400).json({ success: false, message: 'partyType must be contractor or labour' });
        if (!partyId) return res.status(400).json({ success: false, message: 'A contractor or labourer is required' });
        if (!categoryId) return res.status(400).json({ success: false, message: 'Category is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const project = await FinanceProject.findOne({ _id: projectId, deleted: { $ne: true } });
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        const work = await FinanceWork.findOne({ _id: workId, projectId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found on this project' });
        const party = await assertParty(partyType, partyId);
        const category = await assertCategory(categoryId);

        const item = new FinanceClientDirectPayment({
            projectId, workId, partyType, partyId, categoryId, amount: Number(amount), date, notes: notes || '',
        });
        await item.save();
        broadcast({ type: 'clientDirectPaymentsChanged', projectId, partyType, partyId });

        await logActivity({
            eventType: 'client_direct_payment_recorded',
            entityType: 'financeClientDirectPayment',
            entityId: item._id,
            projectId,
            summary: `Client paid ${party.name} ₹${amount} directly (${category.name})`,
            amount: Number(amount),
            req,
        });

        res.json({ success: true, message: 'Client direct payment recorded', data: item });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error recording client direct payment' });
    }
};

const updateClientDirectPayment = async (req, res) => {
    try {
        const { _id, workId, partyType, partyId, categoryId, amount, date, notes } = req.body;
        const existing = await FinanceClientDirectPayment.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!workId) return res.status(400).json({ success: false, message: 'Work is required' });
        if (!['contractor', 'labour'].includes(partyType)) return res.status(400).json({ success: false, message: 'partyType must be contractor or labour' });
        if (!partyId) return res.status(400).json({ success: false, message: 'A contractor or labourer is required' });
        if (!categoryId) return res.status(400).json({ success: false, message: 'Category is required' });
        if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const work = await FinanceWork.findOne({ _id: workId, projectId: existing.projectId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found on this project' });
        await assertParty(partyType, partyId);
        await assertCategory(categoryId);

        await FinanceClientDirectPayment.findByIdAndUpdate(_id, {
            workId, partyType, partyId, categoryId, amount: Number(amount), date, notes: notes || '',
        });
        broadcast({ type: 'clientDirectPaymentsChanged', projectId: existing.projectId, partyType, partyId });
        res.json({ success: true, message: 'Client direct payment updated' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || 'Error updating client direct payment' });
    }
};

const removeClientDirectPayment = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceClientDirectPayment.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'clientDirectPaymentsChanged', projectId: item.projectId, partyType: item.partyType, partyId: item.partyId });
        res.json({ success: true, message: 'Client direct payment removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing client direct payment' });
    }
};

export { listClientDirectPayments, addClientDirectPayment, updateClientDirectPayment, removeClientDirectPayment };
