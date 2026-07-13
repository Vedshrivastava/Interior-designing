import FinanceProject from '../models/financeProject.js';
import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import FinanceTeamRate from '../models/financeTeamRate.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

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
            const [workTypeRateCount, teamRateCount] = await Promise.all([
                FinanceWorkTypeRate.countDocuments({ projectId: p._id, deleted: { $ne: true } }),
                FinanceTeamRate.countDocuments({ projectId: p._id, deleted: { $ne: true } }),
            ]);
            const missing = [];
            if (workTypeRateCount === 0) missing.push('work type rates');
            if (teamRateCount === 0) missing.push('team rates');
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

        const [workTypeRates, teamRates] = await Promise.all([
            FinanceWorkTypeRate.find({ projectId: project._id, deleted: { $ne: true } }).sort({ workType: 1 }),
            FinanceTeamRate.find({ projectId: project._id, deleted: { $ne: true } }).populate('teamId', 'name').sort({ workType: 1 }),
        ]);

        res.json({ success: true, data: { project, workTypeRates, teamRates } });
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
            labourContractorVendorId: data.labourContractorVendorId || null,
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
            labourContractorVendorId: merged.labourContractorVendorId || null,
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

        const [workTypeRateCount, teamRateCount] = await Promise.all([
            FinanceWorkTypeRate.countDocuments({ projectId: _id, deleted: { $ne: true } }),
            FinanceTeamRate.countDocuments({ projectId: _id, deleted: { $ne: true } }),
        ]);

        const missing = [];
        if (workTypeRateCount === 0) missing.push('at least one work type rate');
        if (teamRateCount === 0) missing.push('at least one team rate');
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
