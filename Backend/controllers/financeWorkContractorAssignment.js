import FinanceWork from '../models/financeWork.js';
import FinanceWorkContractorAssignment from '../models/financeWorkContractorAssignment.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import { assertContractorVendor } from '../utils/contractorVendor.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listWorkContractorAssignments = async (req, res) => {
    try {
        const { workId } = req.query;
        if (!workId) return res.status(400).json({ success: false, message: 'workId is required' });
        const rows = await FinanceWorkContractorAssignment.find({ workId, deleted: { $ne: true } })
            .populate('contractorVendorId', 'name')
            .sort({ createdAt: 1 });
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching contractor assignments' });
    }
};

const addWorkContractorAssignment = async (req, res) => {
    try {
        const { workId, contractorVendorId, notes } = req.body;
        if (!workId || !contractorVendorId) return res.status(400).json({ success: false, message: 'Work and contractor are required' });
        const work = await FinanceWork.findOne({ _id: workId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found' });
        await assertContractorVendor(contractorVendorId);

        const item = await FinanceWorkContractorAssignment.create({ workId, contractorVendorId, notes: notes || '' });
        broadcast({ type: 'financeWorkContractorAssignmentsChanged', projectId: work.projectId });
        await logActivity({
            eventType: 'work_contractor_assignment_added',
            entityType: 'financeWorkContractorAssignment',
            entityId: item._id,
            projectId: work.projectId,
            summary: `Contractor added to '${work.workType}'`,
            req,
        });
        res.json({ success: true, message: 'Contractor assigned', data: item });
    } catch (err) {
        console.error(err);
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'This contractor is already assigned to this work' });
        res.status(err.message?.includes('not') ? 400 : 500).json({ success: false, message: err.message || 'Error assigning contractor' });
    }
};

// A Work must always have at least one contractor or labourer assigned —
// rejects removing the last remaining active contractor assignment if no
// labourer is covering the work either.
const removeWorkContractorAssignment = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceWorkContractorAssignment.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        const [activeCount, labourCount] = await Promise.all([
            FinanceWorkContractorAssignment.countDocuments({ workId: item.workId, deleted: { $ne: true } }),
            FinanceWorkLabourAssignment.countDocuments({ workId: item.workId, deleted: { $ne: true } }),
        ]);
        if (activeCount <= 1 && labourCount === 0) {
            return res.status(400).json({ success: false, message: 'A work must have at least one contractor or labourer assigned' });
        }

        const work = await FinanceWork.findById(item.workId);
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeWorkContractorAssignmentsChanged', projectId: work?.projectId });
        await logActivity({
            eventType: 'work_contractor_assignment_removed',
            entityType: 'financeWorkContractorAssignment',
            entityId: item._id,
            projectId: work?.projectId,
            summary: `Contractor removed from '${work?.workType || 'work'}'`,
            req,
        });
        res.json({ success: true, message: 'Contractor removed from work' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing contractor assignment' });
    }
};

export { listWorkContractorAssignments, addWorkContractorAssignment, removeWorkContractorAssignment };
