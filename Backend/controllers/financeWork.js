import FinanceWork from '../models/financeWork.js';
import FinanceProject from '../models/financeProject.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

const listWorks = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const items = await FinanceWork.find({ projectId, deleted: { $ne: true } })
            .populate('teamId', 'name')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching works' });
    }
};

const addWork = async (req, res) => {
    try {
        const { projectId, workType, teamId, workOrderNumber, startDate, estimatedAreaSqft, notes } = req.body;
        if (!projectId || !workType || !teamId) {
            return res.status(400).json({ success: false, message: 'Project, work type, and team are required' });
        }
        if (!estimatedAreaSqft || Number(estimatedAreaSqft) <= 0) {
            return res.status(400).json({ success: false, message: 'Estimated area is required' });
        }
        const item = new FinanceWork({
            projectId, workType: workType.trim(), teamId,
            workOrderNumber: workOrderNumber || '',
            startDate: startDate || null,
            estimatedAreaSqft: Number(estimatedAreaSqft),
            notes: notes || '',
        });
        await item.save();
        broadcast({ type: 'financeWorksChanged', projectId });

        const project = await FinanceProject.findById(projectId).select('name');
        await logActivity({
            eventType: 'work_created',
            entityType: 'financeWork',
            entityId: item._id,
            projectId,
            summary: `New work '${workType.trim()}' started at ${project?.name || 'project'}`,
            req,
        });

        res.json({ success: true, message: 'Work added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding work' });
    }
};

// completedAreaSqft is deliberately never accepted here — it's a running
// total only the measurement-save automation is allowed to change.
const updateWork = async (req, res) => {
    try {
        const { _id, workType, teamId, workOrderNumber, startDate, estimatedAreaSqft, status, notes } = req.body;
        const existing = await FinanceWork.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Work not found' });
        if (!workType || !teamId) return res.status(400).json({ success: false, message: 'Work type and team are required' });

        const newStatus = ['active', 'completed'].includes(status) ? status : existing.status;
        await FinanceWork.findByIdAndUpdate(_id, {
            workType: workType.trim(), teamId,
            workOrderNumber: workOrderNumber || '',
            startDate: startDate || null,
            estimatedAreaSqft: Number(estimatedAreaSqft) || existing.estimatedAreaSqft,
            status: newStatus,
            notes: notes || '',
        });
        broadcast({ type: 'financeWorksChanged', projectId: existing.projectId });

        if (existing.status !== 'completed' && newStatus === 'completed') {
            const project = await FinanceProject.findById(existing.projectId).select('name');
            await logActivity({
                eventType: 'work_completed',
                entityType: 'financeWork',
                entityId: existing._id,
                projectId: existing.projectId,
                summary: `Work '${existing.workType}' completed at ${project?.name || 'project'}`,
                req,
            });
        }

        res.json({ success: true, message: 'Work updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating work' });
    }
};

const removeWork = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceWork.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeWorksChanged', projectId: item.projectId });
        res.json({ success: true, message: `"${item.workType}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing work' });
    }
};

export { listWorks, addWork, updateWork, removeWork };
