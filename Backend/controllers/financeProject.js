import FinanceProject from '../models/financeProject.js';
import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import FinanceContractorRate from '../models/financeContractorRate.js';
import FinanceWork from '../models/financeWork.js';
import FinanceWorkContractorAssignment from '../models/financeWorkContractorAssignment.js';
import FinanceVendor from '../models/financeVendor.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

// Contractor is per-Work, via financeWorkContractorAssignment ->
// financeVendor directly (a Work can have more than one contractor) — not
// a single project-level field. financeProject.labourContractorVendorId
// stays in the schema for old records but is no longer authoritative;
// this derives the real, current set fresh every time.
const computeProjectContractors = async (projectId) => {
    const works = await FinanceWork.find({ projectId, deleted: { $ne: true } }, '_id workType');
    if (!works.length) return [];
    const workById = new Map(works.map(w => [w._id.toString(), w]));

    const assignments = await FinanceWorkContractorAssignment.find({
        workId: { $in: works.map(w => w._id) }, deleted: { $ne: true },
    });
    if (!assignments.length) return [];
    const vendorIds = [...new Set(assignments.map(a => a.contractorVendorId.toString()))];
    const vendors = await FinanceVendor.find({ _id: { $in: vendorIds }, deleted: { $ne: true } });
    const vendorById = new Map(vendors.map(v => [v._id.toString(), v]));

    const byVendor = new Map();
    for (const a of assignments) {
        const work = workById.get(a.workId.toString());
        const vendor = vendorById.get(a.contractorVendorId.toString());
        if (!work || !vendor) continue;
        const vendorId = vendor._id.toString();
        if (!byVendor.has(vendorId)) {
            byVendor.set(vendorId, { vendorId: vendor._id, vendorName: vendor.name, workTypes: new Set() });
        }
        byVendor.get(vendorId).workTypes.add(work.workType);
    }
    return [...byVendor.values()].map(v => ({ ...v, workTypes: [...v.workTypes] }));
};

// Contract-type-specific field rules — enforced server-side so the wizard's
// conditional UI can't be bypassed by a direct API call.
const applyContractTypeRules = (data) => {
    const out = { ...data };
    if (out.contractType === 'with_material') {
        out.materialTrackingEnabled = true;
    } else if (out.contractType === 'without_material') {
        out.materialTrackingEnabled = false;
        out.referralVendorId = out.referralVendorId || null; // still optional, unlike advance
    } else if (out.contractType === 'advance') {
        out.referralVendorId = null; // hidden — not applicable to advance
        if (out.materialTrackingEnabled === undefined) out.materialTrackingEnabled = true;
    }

    if (out.contractType === 'advance') {
        out.totalEstimatedCost = Number(out.totalEstimatedCost) || 0;
        out.contractPercentage = Number(out.contractPercentage) || 0;
        out.advanceAmount = out.totalEstimatedCost * (out.contractPercentage / 100);
    } else {
        out.totalEstimatedCost = 0;
        out.contractPercentage = 0;
        out.advanceAmount = 0;
    }
    return out;
};

const listFinanceProjects = async (req, res) => {
    try {
        const projects = await FinanceProject.find({ deleted: { $ne: true } })
            .populate('clientId', 'name')
            .populate('labourContractorVendorId', 'name')
            .populate('referralVendorId', 'name')
            .populate('assignedSupervisorId', 'name')
            .sort({ createdAt: -1 });

        const withReadiness = await Promise.all(projects.map(async (p) => {
            const [workTypeRateCount, contractorRateCount] = await Promise.all([
                FinanceWorkTypeRate.countDocuments({ projectId: p._id, deleted: { $ne: true } }),
                FinanceContractorRate.countDocuments({ projectId: p._id, deleted: { $ne: true } }),
            ]);
            const missing = [];
            if (workTypeRateCount === 0) missing.push('work type rates');
            if (contractorRateCount === 0) missing.push('contractor rates');
            if (p.contractType === 'advance' && !p.advanceReceived) missing.push('advance payment');
            return { ...p.toObject(), readiness: { ready: missing.length === 0, missing } };
        }));

        res.json({ success: true, data: withReadiness });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching projects' });
    }
};

const getFinanceProject = async (req, res) => {
    try {
        const project = await FinanceProject.findOne({ _id: req.params.id, deleted: { $ne: true } })
            .populate('clientId', 'name phone email')
            .populate('labourContractorVendorId', 'name')
            .populate('referralVendorId', 'name')
            .populate('assignedSupervisorId', 'name');
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        const [workTypeRates, contractorRates, contractors] = await Promise.all([
            FinanceWorkTypeRate.find({ projectId: project._id, deleted: { $ne: true } }).sort({ workType: 1 }),
            FinanceContractorRate.find({ projectId: project._id, deleted: { $ne: true } }).populate('contractorVendorId', 'name').sort({ workType: 1 }),
            computeProjectContractors(project._id),
        ]);

        res.json({ success: true, data: { project, workTypeRates, contractorRates, contractors } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching project' });
    }
};

const addFinanceProject = async (req, res) => {
    try {
        const { name, clientId, contractType } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Project name is required' });
        if (!clientId) return res.status(400).json({ success: false, message: 'Client is required' });
        if (!['with_material', 'without_material', 'advance'].includes(contractType)) {
            return res.status(400).json({ success: false, message: 'A valid contract type is required' });
        }
        // Total cost / contract % belong to the wizard's Step 3, not Step 2 — not
        // required to create the draft, only to activate it (see activateFinanceProject).

        const data = applyContractTypeRules(req.body);
        const project = new FinanceProject({
            name: name.trim(),
            clientId,
            siteLocation: data.siteLocation || '',
            startDate: data.startDate || null,
            estimatedAreaSqft: data.estimatedAreaSqft || 0,
            notes: data.notes || '',
            contractType,
            assignedSupervisor: data.assignedSupervisor || '',
            assignedSupervisorId: data.assignedSupervisorId || null,
            // labourContractorVendorId intentionally not settable here — contractor
            // assignment is per-Work (see computeProjectContractors above), not a
            // single project-level field. The schema field stays for old records.
            referralVendorId: data.referralVendorId || null,
            materialTrackingEnabled: data.materialTrackingEnabled,
            totalEstimatedCost: data.totalEstimatedCost,
            contractPercentage: data.contractPercentage,
            advanceAmount: data.advanceAmount,
            status: 'draft',
        });
        await project.save();
        broadcast({ type: 'financeProjectsChanged' });

        await logActivity({
            eventType: 'project_created',
            entityType: 'financeProject',
            entityId: project._id,
            projectId: project._id,
            summary: `New project '${project.name}' created`,
            req,
        });

        res.json({ success: true, message: 'Project draft created', data: project });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error creating project' });
    }
};

const updateFinanceProject = async (req, res) => {
    try {
        const { _id } = req.body;
        const existing = await FinanceProject.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Project not found' });

        const contractType = req.body.contractType || existing.contractType;
        const merged = applyContractTypeRules({ ...existing.toObject(), ...req.body, contractType });

        await FinanceProject.findByIdAndUpdate(_id, {
            name: (merged.name || existing.name).trim(),
            clientId: merged.clientId,
            siteLocation: merged.siteLocation || '',
            startDate: merged.startDate || null,
            estimatedAreaSqft: merged.estimatedAreaSqft || 0,
            notes: merged.notes || '',
            contractType,
            assignedSupervisor: merged.assignedSupervisor || '',
            assignedSupervisorId: merged.assignedSupervisorId || null,
            // labourContractorVendorId intentionally not settable here — see
            // addFinanceProject's comment above.
            referralVendorId: merged.referralVendorId,
            materialTrackingEnabled: merged.materialTrackingEnabled,
            totalEstimatedCost: merged.totalEstimatedCost,
            contractPercentage: merged.contractPercentage,
            advanceAmount: merged.advanceAmount,
        });
        broadcast({ type: 'financeProjectsChanged' });
        res.json({ success: true, message: 'Project updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating project' });
    }
};

const recordAdvanceInvoiced = async (req, res) => {
    try {
        const { _id } = req.body;
        const project = await FinanceProject.findById(_id);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        if (project.contractType !== 'advance') return res.status(400).json({ success: false, message: 'Not an Advance project' });
        project.advanceInvoiced = true;
        project.advanceInvoicedAt = new Date();
        await project.save();
        res.json({ success: true, message: 'Advance marked as invoiced', data: project });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating advance status' });
    }
};

const recordAdvanceReceived = async (req, res) => {
    try {
        const { _id, notes } = req.body;
        const project = await FinanceProject.findById(_id);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        if (project.contractType !== 'advance') return res.status(400).json({ success: false, message: 'Not an Advance project' });
        project.advanceReceived = true;
        project.advanceReceivedAt = new Date();
        project.advanceReceivedNotes = notes || '';
        await project.save();
        broadcast({ type: 'financeProjectsChanged' });
        res.json({ success: true, message: 'Advance payment recorded', data: project });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording advance payment' });
    }
};

const activateFinanceProject = async (req, res) => {
    try {
        const { _id } = req.body;
        const project = await FinanceProject.findById(_id);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        if (project.status === 'active') return res.json({ success: true, message: 'Already active', data: project });

        const [workTypeRateCount, contractorRateCount] = await Promise.all([
            FinanceWorkTypeRate.countDocuments({ projectId: _id, deleted: { $ne: true } }),
            FinanceContractorRate.countDocuments({ projectId: _id, deleted: { $ne: true } }),
        ]);

        const missing = [];
        if (workTypeRateCount === 0) missing.push('at least one work type rate');
        if (contractorRateCount === 0) missing.push('at least one contractor rate');
        if (project.contractType === 'advance') {
            if (!project.totalEstimatedCost || !project.contractPercentage) missing.push('the total estimated cost and contract percentage');
            if (!project.advanceReceived) missing.push('the advance payment');
        }

        if (missing.length > 0) {
            return res.status(400).json({ success: false, message: `Can't activate — missing ${missing.join(', ')}.` });
        }

        project.status = 'active';
        await project.save();
        broadcast({ type: 'financeProjectsChanged' });

        await logActivity({
            eventType: 'project_activated',
            entityType: 'financeProject',
            entityId: project._id,
            projectId: project._id,
            summary: `Project '${project.name}' activated`,
            req,
        });

        res.json({ success: true, message: 'Project is now active', data: project });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error activating project' });
    }
};

const removeFinanceProject = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceProject.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeProjectsChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing project' });
    }
};

export {
    listFinanceProjects, getFinanceProject, addFinanceProject, updateFinanceProject,
    recordAdvanceInvoiced, recordAdvanceReceived, activateFinanceProject, removeFinanceProject,
};
