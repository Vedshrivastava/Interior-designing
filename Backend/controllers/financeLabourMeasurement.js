import FinanceLabourMeasurement from '../models/financeLabourMeasurement.js';
import FinanceWork from '../models/financeWork.js';
import FinanceProject from '../models/financeProject.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

// projectId is optional — omit it for a cross-project view (Site
// Operations' Daily Measurements).
const listLabourMeasurements = async (req, res) => {
    try {
        const { projectId, workId, labourerId } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        if (workId) filter.workId = workId;
        if (labourerId) filter.labourerId = labourerId;
        const items = await FinanceLabourMeasurement.find(filter)
            .populate('workId', 'workType workOrderNumber')
            .populate('labourerId', 'name')
            .populate('supervisorId', 'name')
            .populate('projectId', 'name')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching labour measurements' });
    }
};

// No engineerApproved gate here (unlike financeMeasurement) — every logged
// sqft counts toward the labourer's earnings immediately. Correction is a
// deduction entered afterward (financeLabourDeduction), not an area
// exclusion. Still increments the Work's shared completedAreaSqft, same
// automation trigger as a contractor's measurement.
const addLabourMeasurement = async (req, res) => {
    try {
        const { projectId, workId, labourerId, date, remarks } = req.body;
        const areaCoveredSqft = Number(req.body.areaCoveredSqft);

        if (!projectId || !workId || !date) {
            return res.status(400).json({ success: false, message: 'Project, work, and date are required' });
        }
        if (!labourerId) return res.status(400).json({ success: false, message: 'Labourer is required' });
        if (!areaCoveredSqft || areaCoveredSqft <= 0) {
            return res.status(400).json({ success: false, message: 'Area covered must be greater than zero' });
        }

        const work = await FinanceWork.findOne({ _id: workId, projectId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: 'Work not found for this project' });

        const assignment = await FinanceWorkLabourAssignment.findOne({ workId, labourerId, deleted: { $ne: true } });
        if (!assignment) {
            return res.status(400).json({ success: false, message: 'Labourer is not assigned to this work' });
        }

        const project = await FinanceProject.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        const measurement = new FinanceLabourMeasurement({
            projectId, workId, labourerId, date, areaCoveredSqft,
            // Whoever currently runs this labourer's team on this Work — the
            // caller doesn't need to pass this explicitly, it's already a
            // fact of the assignment, not something re-entered per measurement.
            supervisorId: req.body.supervisorId || assignment.supervisorId || null,
            remarks: remarks || '',
        });
        await measurement.save();

        await FinanceWork.findByIdAndUpdate(workId, { $inc: { completedAreaSqft: areaCoveredSqft } });

        broadcast({ type: 'financeLabourMeasurementsChanged', projectId });
        broadcast({ type: 'financeWorksChanged', projectId });

        await logActivity({
            eventType: 'labour_measurement_logged',
            entityType: 'financeLabourMeasurement',
            entityId: measurement._id,
            projectId,
            summary: `${areaCoveredSqft} sqft logged for ${work.workType} at ${project.name}`,
            req,
        });

        res.json({ success: true, message: 'Measurement saved', data: measurement });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving measurement' });
    }
};

// Same "don't allow editing area" reasoning as financeMeasurement.updateMeasurement.
const updateLabourMeasurement = async (req, res) => {
    try {
        const { _id, remarks } = req.body;
        const existing = await FinanceLabourMeasurement.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Measurement not found' });
        await FinanceLabourMeasurement.findByIdAndUpdate(_id, { remarks: remarks ?? existing.remarks });
        broadcast({ type: 'financeLabourMeasurementsChanged', projectId: existing.projectId });
        res.json({ success: true, message: 'Measurement updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating measurement' });
    }
};

// Reverses completedAreaSqft on delete, same reasoning as financeMeasurement.removeMeasurement.
const removeLabourMeasurement = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceLabourMeasurement.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();

        await FinanceWork.findByIdAndUpdate(item.workId, { $inc: { completedAreaSqft: -item.areaCoveredSqft } });

        broadcast({ type: 'financeLabourMeasurementsChanged', projectId: item.projectId });
        broadcast({ type: 'financeWorksChanged', projectId: item.projectId });

        await logActivity({
            eventType: 'labour_measurement_deleted',
            entityType: 'financeLabourMeasurement',
            entityId: item._id,
            projectId: item.projectId,
            summary: `Labour measurement of ${item.areaCoveredSqft} sqft removed`,
            amount: null,
            req,
        });

        res.json({ success: true, message: 'Measurement moved to recovery bin' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing measurement' });
    }
};

export { listLabourMeasurements, addLabourMeasurement, updateLabourMeasurement, removeLabourMeasurement };
