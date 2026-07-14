import FinanceWork from '../models/financeWork.js';
import FinanceWorkTeamAssignment from '../models/financeWorkTeamAssignment.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

// GET ?workId= — if no real assignment rows exist yet (a pre-migration
// Work), synthesizes one legacy-looking row from the Work's own teamId so
// the UI always has something to show.
const listWorkTeamAssignments = async (req, res) => {
    try {
        const { workId } = req.query;
        if (!workId) return res.status(400).json({ success: false, message: 'workId is required' });
        const rows = await FinanceWorkTeamAssignment.find({ workId, deleted: { $ne: true } })
            .populate('teamId', 'name')
            .sort({ createdAt: 1 });
        if (rows.length) return res.json({ success: true, data: rows });

        const work = await FinanceWork.findById(workId).populate('teamId', 'name');
        if (!work || !work.teamId) return res.json({ success: true, data: [] });
        res.json({ success: true, data: [{ _id: null, workId, teamId: work.teamId, notes: '', legacy: true }] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching team assignments' });
    }
};

const addWorkTeamAssignment = async (req, res) => {
    try {
        const { workId, teamId, notes } = req.body;
        if (!workId || !teamId) return res.status(400).json({ success: false, message: 'Work and team are required' });
        const work = await FinanceWork.findOne({ _id: workId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found' });

        const item = await FinanceWorkTeamAssignment.create({ workId, teamId, notes: notes || '' });
        broadcast({ type: 'financeWorkTeamAssignmentsChanged', projectId: work.projectId });
        await logActivity({
            eventType: 'work_team_assignment_added',
            entityType: 'financeWorkTeamAssignment',
            entityId: item._id,
            projectId: work.projectId,
            summary: `Team added to '${work.workType}'`,
            req,
        });
        res.json({ success: true, message: 'Team assigned', data: item });
    } catch (err) {
        console.error(err);
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'This team is already assigned to this work' });
        res.status(500).json({ success: false, message: 'Error assigning team' });
    }
};

// A Work must always have at least one team — rejects removing the last
// remaining active assignment.
const removeWorkTeamAssignment = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceWorkTeamAssignment.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        const activeCount = await FinanceWorkTeamAssignment.countDocuments({ workId: item.workId, deleted: { $ne: true } });
        if (activeCount <= 1) {
            return res.status(400).json({ success: false, message: 'A work must have at least one team assigned' });
        }

        const work = await FinanceWork.findById(item.workId);
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeWorkTeamAssignmentsChanged', projectId: work?.projectId });
        await logActivity({
            eventType: 'work_team_assignment_removed',
            entityType: 'financeWorkTeamAssignment',
            entityId: item._id,
            projectId: work?.projectId,
            summary: `Team removed from '${work?.workType || 'work'}'`,
            req,
        });
        res.json({ success: true, message: 'Team removed from work' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing team assignment' });
    }
};

export { listWorkTeamAssignments, addWorkTeamAssignment, removeWorkTeamAssignment };
