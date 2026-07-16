import FinanceWork from '../models/financeWork.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import FinanceLabourer from '../models/financeLabourer.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listWorkLabourAssignments = async (req, res) => {
    try {
        const { workId } = req.query;
        if (!workId) return res.status(400).json({ success: false, message: 'workId is required' });
        const rows = await FinanceWorkLabourAssignment.find({ workId, deleted: { $ne: true } })
            .populate('labourerId', 'name')
            .sort({ createdAt: 1 });
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching labour assignments' });
    }
};

const addWorkLabourAssignment = async (req, res) => {
    try {
        const { workId, labourerId, notes } = req.body;
        if (!workId || !labourerId) return res.status(400).json({ success: false, message: 'Work and labourer are required' });
        const work = await FinanceWork.findOne({ _id: workId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found' });
        const labourer = await FinanceLabourer.findOne({ _id: labourerId, deleted: { $ne: true } });
        if (!labourer) return res.status(404).json({ success: false, message: 'Labourer not found' });

        const item = await FinanceWorkLabourAssignment.create({ workId, labourerId, notes: notes || '' });
        broadcast({ type: 'financeWorkLabourAssignmentsChanged', projectId: work.projectId });
        await logActivity({
            eventType: 'work_labour_assignment_added',
            entityType: 'financeWorkLabourAssignment',
            entityId: item._id,
            projectId: work.projectId,
            summary: `${labourer.name} added to '${work.workType}'`,
            req,
        });
        res.json({ success: true, message: 'Labourer assigned', data: item });
    } catch (err) {
        console.error(err);
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'This labourer is already assigned to this work' });
        res.status(500).json({ success: false, message: err.message || 'Error assigning labourer' });
    }
};

const removeWorkLabourAssignment = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceWorkLabourAssignment.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        const work = await FinanceWork.findById(item.workId);
        const labourer = await FinanceLabourer.findById(item.labourerId).select('name');
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeWorkLabourAssignmentsChanged', projectId: work?.projectId });
        await logActivity({
            eventType: 'work_labour_assignment_removed',
            entityType: 'financeWorkLabourAssignment',
            entityId: item._id,
            projectId: work?.projectId,
            summary: `${labourer?.name || 'Labourer'} removed from '${work?.workType || 'work'}'`,
            req,
        });
        res.json({ success: true, message: 'Labourer removed from work' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing labour assignment' });
    }
};

export { listWorkLabourAssignments, addWorkLabourAssignment, removeWorkLabourAssignment };
