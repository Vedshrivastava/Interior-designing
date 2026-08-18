import FinanceWork from '../models/financeWork.js';
import FinanceProject from '../models/financeProject.js';
import FinanceSetting from '../models/financeSetting.js';
import FinanceWorkContractorAssignment from '../models/financeWorkContractorAssignment.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import { assertLabourersAvailable } from '../utils/labourAvailability.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

// Resolves a Work Type's own configured unit (financeSetting.measurementUnit,
// settingType: 'work_type') by the same name-match convention every other
// work-type lookup already uses (financeContractorRate/financeLabourRate/
// financeWorkTypeRate) — falls back to 'sqft' if the type isn't in the list
// at all (a free-typed value, or the row was removed after this Work was
// created) rather than leaving unit unset.
const resolveWorkTypeUnit = async (workType) => {
    const setting = await FinanceSetting.findOne({ settingType: 'work_type', name: workType, deleted: { $ne: true } });
    return setting?.measurementUnit || 'sqft';
};
// Shared with financeProject.js's completion-readiness check — same reasoning
// as that module's own cross-controller imports (e.g. financeMeasurement.js
// importing computeCurrentStock from financeStockMovement.js).
import { computeWorkExpectedPay } from './financeReports.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// projectId is optional — omit it for a cross-project view (e.g. Site
// Operations' Daily Measurements, scanning every project for a given work
// type + date) instead of one project's Works tab.
const listWorks = async (req, res) => {
    try {
        const { projectId } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        const items = await FinanceWork.find(filter)
            .populate('projectId', 'name')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching works' });
    }
};

// `contractorAssignments` — [{ contractorVendorId, notes }] — and a labour
// team — `labourSupervisorId` + `labourerIds: [...]` (one supervisor, the
// labourers they're bringing to this Work) — a Work needs at least one
// contractor or one labourer assigned (it can have both, or either alone).
// Neither is a single field on the Work itself; see
// financeWorkContractorAssignment.js / financeWorkLabourAssignment.js for
// adding/removing either (or a second labour team under a different
// supervisor) on an existing Work.
const addWork = async (req, res) => {
    try {
        const { projectId, workType, contractorAssignments, labourSupervisorId, labourerIds, workOrderNumber, startDate, estimatedAreaSqft, notes, quickAdded } = req.body;
        const assignments = Array.isArray(contractorAssignments) ? contractorAssignments.filter(a => a?.contractorVendorId) : [];
        const labourRows = (labourSupervisorId && Array.isArray(labourerIds)) ? labourerIds.filter(Boolean) : [];
        if (!projectId || !workType || (!assignments.length && !labourRows.length)) {
            return res.status(400).json({ success: false, message: 'Project, work type, and at least one contractor or labourer are required' });
        }
        if (!estimatedAreaSqft || Number(estimatedAreaSqft) <= 0) {
            return res.status(400).json({ success: false, message: 'Estimated area is required' });
        }
        if (labourRows.length) await assertLabourersAvailable(labourRows);

        const item = new FinanceWork({
            projectId, workType: workType.trim(),
            workOrderNumber: workOrderNumber || '',
            startDate: startDate || null,
            estimatedAreaSqft: Number(estimatedAreaSqft),
            unit: await resolveWorkTypeUnit(workType.trim()),
            notes: notes || '',
            quickAdded: !!quickAdded,
        });
        await item.save();
        if (assignments.length) {
            await FinanceWorkContractorAssignment.insertMany(
                assignments.map(a => ({ workId: item._id, contractorVendorId: a.contractorVendorId, notes: a.notes || '' }))
            );
            broadcast({ type: 'financeWorkContractorAssignmentsChanged', projectId });
        }
        if (labourRows.length) {
            await FinanceWorkLabourAssignment.insertMany(
                labourRows.map(labourerId => ({ workId: item._id, labourerId, supervisorId: labourSupervisorId }))
            );
            broadcast({ type: 'financeWorkLabourAssignmentsChanged', projectId });
        }
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
        res.status(400).json({ success: false, message: err.message || 'Error adding work' });
    }
};

// completedAreaSqft is deliberately never accepted here — it's a running
// total only the measurement-save automation is allowed to change.
// Contractor assignment also isn't accepted here anymore — see
// financeWorkContractorAssignment.js.
const updateWork = async (req, res) => {
    try {
        const { _id, workType, workOrderNumber, startDate, estimatedAreaSqft, status, notes, confirmOverride } = req.body;
        const existing = await FinanceWork.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Work not found' });
        if (!workType) return res.status(400).json({ success: false, message: 'Work type is required' });

        const newStatus = ['active', 'completed'].includes(status) ? status : existing.status;

        // Warn-don't-block, same pattern as completeFinanceProject
        // (financeProject.js): a Work completing with real unreviewed area
        // still on it silently drops that contractor/labour/commission
        // liability out of company-wide "approved" aggregates, since those
        // only scan active works — this was the direct cause of an earlier
        // dashboard-mismatch bug, patched downstream but never at the
        // source. Surface it once; confirmOverride:true pushes through
        // (a Work can legitimately close with a small unreviewed tail, same
        // as a project closing with one stray balance).
        if (existing.status !== 'completed' && newStatus === 'completed') {
            const expectedPay = await computeWorkExpectedPay(existing);
            if (expectedPay.unapprovedAreaSqft > 0.01 && !confirmOverride) {
                return res.status(400).json({
                    success: false,
                    message: 'This work has unreviewed area',
                    blockers: [{
                        category: 'unreviewed_area',
                        label: `${round2(expectedPay.unapprovedAreaSqft)} sqft logged but never reviewed`,
                        amount: round2(expectedPay.unapprovedAmount),
                    }],
                });
            }
        }

        // Re-resolved every save (not just when workType visibly changes) —
        // cheap, and keeps a Work's unit in sync if its Work Type's own
        // configured unit was edited in Settings since this Work was
        // created, same "reflects current type" semantics as workType
        // itself already has here.
        await FinanceWork.findByIdAndUpdate(_id, {
            workType: workType.trim(),
            workOrderNumber: workOrderNumber || '',
            startDate: startDate || null,
            estimatedAreaSqft: Number(estimatedAreaSqft) || existing.estimatedAreaSqft,
            unit: await resolveWorkTypeUnit(workType.trim()),
            status: newStatus,
            notes: notes || '',
            // Reaching this endpoint only happens through the full Edit Work
            // form, which exposes every field the quick-add path skipped —
            // so any save here, regardless of what changed, resolves the
            // "Details Missing" badge.
            quickAdded: false,
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
