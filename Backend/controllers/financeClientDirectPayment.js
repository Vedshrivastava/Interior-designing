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

// Sum of client-direct-payment amounts (category flagged "cut from worker
// payout") for one contractor/labourer, bucketed per Work — needed
// wherever a Work's own Approved/Unapproved split has to absorb a specific
// direct payment correctly (a direct payment is entered against one exact
// Work, so it must net against THAT Work's own unapproved amount first —
// pooling it across every Work a party has on a project would let a
// payment tied to one Work "borrow" absorption capacity from another).
// Returns Map<workId, amount>; callers do their own unapproved-first split
// since only they know each Work's own unapproved amount.
export const getWorkerPayoutDeductionByWork = async (partyType, partyId, workIds) => {
    const byWork = new Map();
    if (!workIds.length) return byWork;
    const categoryIds = await categoryIdsWithFlag('deductFromWorkerPayout');
    if (!categoryIds.length) return byWork;
    const rows = await FinanceClientDirectPayment.find(
        { partyType, partyId, workId: { $in: workIds }, categoryId: { $in: categoryIds }, deleted: { $ne: true } },
        'workId amount'
    );
    for (const r of rows) {
        const key = r.workId.toString();
        byWork.set(key, (byWork.get(key) || 0) + r.amount);
    }
    return byWork;
};

// Company-wide bulk variant — every direct payment across a set of Works
// (the Dashboard's live operational widget spans every non-completed Work
// at once), split into a contractor map and a labour map, each keyed by
// `${workId}_${partyId}` to match computeDashboardApprovedBreakdown's own
// per-(work,party) accumulation keys.
export const getWorkerPayoutDeductionsBulk = async (workIds) => {
    const empty = { contractorByWorkParty: new Map(), labourByWorkParty: new Map() };
    if (!workIds.length) return empty;
    const categoryIds = await categoryIdsWithFlag('deductFromWorkerPayout');
    if (!categoryIds.length) return empty;
    const rows = await FinanceClientDirectPayment.find(
        { workId: { $in: workIds }, categoryId: { $in: categoryIds }, deleted: { $ne: true } },
        'workId partyType partyId amount'
    );
    for (const r of rows) {
        const key = `${r.workId}_${r.partyId}`;
        const map = r.partyType === 'contractor' ? empty.contractorByWorkParty : empty.labourByWorkParty;
        map.set(key, (map.get(key) || 0) + r.amount);
    }
    return empty;
};

// Inverse of getWorkerPayoutDeductionByWork — one Work, every party that
// has a direct payment against it (a Work Detail page needs this since it
// shows every contributing contractor/labourer at once, not one party at a
// time). Returns Map<`${partyType}_${partyId}`, amount>.
export const getWorkerPayoutDeductionsForWork = async (workId) => {
    const byParty = new Map();
    const categoryIds = await categoryIdsWithFlag('deductFromWorkerPayout');
    if (!categoryIds.length) return byParty;
    const rows = await FinanceClientDirectPayment.find(
        { workId, categoryId: { $in: categoryIds }, deleted: { $ne: true } },
        'partyType partyId amount'
    );
    for (const r of rows) {
        const key = `${r.partyType}_${r.partyId}`;
        byParty.set(key, (byParty.get(key) || 0) + r.amount);
    }
    return byParty;
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
