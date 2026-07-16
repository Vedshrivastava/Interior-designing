import FinanceWork from '../models/financeWork.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceEmployee from '../models/financeEmployee.js';
import { assertLabourersAvailable } from '../utils/labourAvailability.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

// Either workId (one Work's team roster) or supervisorId (every assignment
// across every Work where this employee is running a team, for the
// Supervisors page's read-only team view) — at least one is required.
const listWorkLabourAssignments = async (req, res) => {
    try {
        const { workId, supervisorId } = req.query;
        if (!workId && !supervisorId) return res.status(400).json({ success: false, message: 'workId or supervisorId is required' });
        const filter = { deleted: { $ne: true } };
        if (workId) filter.workId = workId;
        if (supervisorId) filter.supervisorId = supervisorId;
        const rows = await FinanceWorkLabourAssignment.find(filter)
            .populate('labourerId', 'name')
            .populate('supervisorId', 'name')
            .populate({ path: 'workId', select: 'workType projectId', populate: { path: 'projectId', select: 'name' } })
            .sort({ createdAt: 1 });
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching labour assignments' });
    }
};

// Adds a whole team in one action — one supervisor, several labourers —
// rather than one labourer at a time. A Work can have this called more
// than once with a different supervisor each time (more than one team on
// the same Work is normal); labourers already on this Work are silently
// skipped rather than erroring the whole batch. Labourers already active
// on a *different* Work hard-block the whole batch instead — one person
// can only be on one Work at a time, so reassigning them means removing
// their old assignment first.
const batchAddWorkLabourAssignment = async (req, res) => {
    try {
        const { workId, supervisorId, labourerIds, notes } = req.body;
        if (!workId || !supervisorId) return res.status(400).json({ success: false, message: 'Work and supervisor are required' });
        if (!Array.isArray(labourerIds) || !labourerIds.length) {
            return res.status(400).json({ success: false, message: 'At least one labourer is required' });
        }
        const work = await FinanceWork.findOne({ _id: workId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found' });
        const supervisor = await FinanceEmployee.findById(supervisorId).select('name');
        if (!supervisor) return res.status(404).json({ success: false, message: 'Supervisor not found' });

        const labourers = await FinanceLabourer.find({ _id: { $in: labourerIds }, deleted: { $ne: true } });
        if (labourers.length !== labourerIds.length) {
            return res.status(400).json({ success: false, message: 'One or more selected labourers were not found' });
        }

        const existing = await FinanceWorkLabourAssignment.find({ workId, labourerId: { $in: labourerIds }, deleted: { $ne: true } });
        const alreadyAssigned = new Set(existing.map(a => a.labourerId.toString()));
        const toCreate = labourerIds.filter(id => !alreadyAssigned.has(id));

        if (!toCreate.length) {
            return res.status(400).json({ success: false, message: 'All selected labourers are already assigned to this work' });
        }

        await assertLabourersAvailable(toCreate, workId);

        const created = await FinanceWorkLabourAssignment.insertMany(
            toCreate.map(labourerId => ({ workId, labourerId, supervisorId, notes: notes || '' }))
        );

        broadcast({ type: 'financeWorkLabourAssignmentsChanged', projectId: work.projectId });
        await logActivity({
            eventType: 'work_labour_team_added',
            entityType: 'financeWorkLabourAssignment',
            entityId: created[0]._id,
            projectId: work.projectId,
            summary: `Team of ${created.length} added to '${work.workType}' under ${supervisor.name}`,
            req,
        });

        const skipped = labourerIds.length - toCreate.length;
        res.json({
            success: true,
            message: skipped > 0 ? `${created.length} labourer(s) added, ${skipped} already assigned` : `${created.length} labourer(s) added`,
            data: created,
        });
    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false, message: err.message || 'Error assigning team' });
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

export { listWorkLabourAssignments, batchAddWorkLabourAssignment, removeWorkLabourAssignment };
