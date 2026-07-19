import FinanceProject from '../models/financeProject.js';
import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import FinanceContractorRate from '../models/financeContractorRate.js';
import FinanceWork from '../models/financeWork.js';
import FinanceWorkContractorAssignment from '../models/financeWorkContractorAssignment.js';
import FinanceWorkLabourAssignment from '../models/financeWorkLabourAssignment.js';
import FinanceVendor from '../models/financeVendor.js';
import FinanceReceipt from '../models/financeReceipt.js';
import FinanceCompanySettings from '../models/financeCompanySettings.js';
import PDFDocument from 'pdfkit';
import { writeLetterhead, drawInfoBox, writeFooter, formatCurrency, formatDate } from '../utils/pdfLetterhead.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';
// Cross-controller import — same established pattern as
// financeContractorLedger.js/financeLabourLedger.js/financeRunningBill.js
// already importing shared computations from financeReports.js.
import { getProjectCompletionReadiness } from './financeReports.js';

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
    } else if (out.contractType === 'advance') {
        if (out.materialTrackingEnabled === undefined) out.materialTrackingEnabled = true;
    }
    out.referralVendorId = out.referralVendorId || null; // optional for every contract type

    if (out.contractType === 'advance') {
        out.totalEstimatedCost = Number(out.totalEstimatedCost) || 0;
        out.advanceAmount = Number(out.advanceAmount) || 0; // manually entered, not computed
    } else {
        out.totalEstimatedCost = 0;
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

// Revisitable — not just a New Project Wizard step. Also creates the
// financeReceipt that actually carries this money (runningBillId null,
// isAdvance true) so it's real, drawable-down credit once billing starts,
// not just a boolean on the project. Guarded against being called twice
// for the same project, which would otherwise double-book the receipt.
const recordAdvanceReceived = async (req, res) => {
    try {
        const { _id, notes, paymentMode, bankAccountId, utrNumber } = req.body;
        const project = await FinanceProject.findById(_id);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        if (project.contractType !== 'advance') return res.status(400).json({ success: false, message: 'Not an Advance project' });
        if (project.advanceReceived) return res.status(400).json({ success: false, message: 'Advance already recorded for this project' });

        project.advanceReceived = true;
        project.advanceReceivedAt = new Date();
        project.advanceReceivedNotes = notes || '';
        await project.save();

        await FinanceReceipt.create({
            clientId: project.clientId, projectId: project._id,
            amount: project.advanceAmount, receiptDate: project.advanceReceivedAt,
            notes: 'Advance payment', isAdvance: true,
            paymentMode: paymentMode || '', bankAccountId: bankAccountId || null, utrNumber: utrNumber || '',
        });

        broadcast({ type: 'financeProjectsChanged' });
        broadcast({ type: 'financeReceiptsChanged', projectId: project._id, clientId: project.clientId });
        res.json({ success: true, message: 'Advance payment recorded', data: project });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording advance payment' });
    }
};

// Client-facing PDF for the advance itself — deliberately not a Running
// Bill (no line items exist yet at advance time, nothing's been measured).
// Reads straight from the project's own advance fields rather than the
// financeReceipt(s) it created, since those may since have been split/
// linked against later bills by generateRunningBill's drawdown step —
// that's internal bookkeeping the client's receipt shouldn't reflect.
const downloadAdvanceReceipt = async (req, res) => {
    try {
        const project = await FinanceProject.findById(req.params.id).populate('clientId');
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        if (project.contractType !== 'advance' || !project.advanceReceived) {
            return res.status(400).json({ success: false, message: 'No advance payment recorded for this project yet' });
        }

        const company = await FinanceCompanySettings.findOne({ deleted: { $ne: true } }).lean();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Advance-Receipt-${project.name.replace(/[^a-z0-9]+/gi, '-')}.pdf"`);

        const doc = new PDFDocument({ margin: 50, bufferPages: true });
        doc.pipe(res);

        await writeLetterhead(doc, 'Advance Payment Receipt', company, formatDate(project.advanceReceivedAt));

        const { left, width } = { left: doc.page.margins.left, width: doc.page.width - doc.page.margins.left - doc.page.margins.right };
        const colWidth = (width - 24) / 2;
        const infoTopY = doc.y;
        const leftBottom = drawInfoBox(doc, left, colWidth, 'Received From', [
            project.clientId?.name || '—',
            project.clientId?.address,
            project.clientId?.phone ? `Phone: ${project.clientId.phone}` : null,
            project.clientId?.gstNumber ? `GSTIN: ${project.clientId.gstNumber}` : null,
        ], company);
        doc.y = infoTopY;
        const rightBottom = drawInfoBox(doc, left + colWidth + 24, colWidth, 'Project', [
            project.name,
            project.siteLocation,
            `Total Estimated Cost: ${formatCurrency(project.totalEstimatedCost)}`,
        ], company);
        doc.y = Math.max(leftBottom, rightBottom) + 16;

        const accentColor = company?.accentColor || '#2c3e50';
        const bannerH = 46;
        doc.rect(left, doc.y, width, bannerH).fill('#eafaf1');
        doc.fillColor('#1e8449').font('Helvetica-Bold').fontSize(15)
            .text(`Advance Received: ${formatCurrency(project.advanceAmount)}`, left + 14, doc.y + 14);
        doc.fillColor('#000000').font('Helvetica').fontSize(10);
        doc.y += bannerH + 14;

        doc.font('Helvetica').fontSize(10);
        doc.text(`Date Received: ${formatDate(project.advanceReceivedAt)}`);
        if (project.advanceReceivedNotes) doc.text(`Notes: ${project.advanceReceivedNotes}`);
        doc.moveDown(0.8);
        doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(10)
            .text('This advance is adjustable against the final project cost and will be drawn down against your first running bill(s) as work is billed.');
        doc.fillColor('#000000').font('Helvetica').fontSize(10);

        writeFooter(doc, company);
        doc.end();
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating advance receipt PDF' });
    }
};

// Advance-only, and only meaningful with a referralVendorId set — the flat
// manually-typed commission amount (see the model's own comment for why
// this isn't sqft × rate the way With/Without Material's referral
// commission is). Standalone endpoint rather than folding into the general
// updateFinanceProject, since callers here (ProjectDetail's own inline
// edit, and the Mark Completed confirm step) only ever want to touch this
// one field, not resend the whole project form.
const updateReferralCommission = async (req, res) => {
    try {
        const { _id, referralCommissionAmount } = req.body;
        const project = await FinanceProject.findById(_id);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        if (project.contractType !== 'advance') {
            return res.status(400).json({ success: false, message: 'Referral commission is only manually entered for Advance projects' });
        }
        project.referralCommissionAmount = Number(referralCommissionAmount) || 0;
        await project.save();
        broadcast({ type: 'financeProjectsChanged' });
        res.json({ success: true, message: 'Referral commission updated', data: project });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating referral commission' });
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
            if (!project.advanceAmount) missing.push('the advance amount');
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

const getCompletionReadiness = async (req, res) => {
    try {
        const readiness = await getProjectCompletionReadiness(req.params.id);
        res.json({ success: true, data: readiness });
    } catch (err) {
        console.error(err);
        res.status(err.message === 'Project not found' ? 404 : 500)
            .json({ success: false, message: err.message || 'Error computing completion readiness' });
    }
};

// Warn-don't-block: a blockers[] list is always computed and returned, but
// only actually stops completion the first time (confirmOverride absent) —
// resubmitting with confirmOverride:true completes regardless of what's
// still outstanding. Real projects often close with a small retention/last
// invoice deliberately left open, so a hard block would leave a
// practically-finished project stuck over one stray balance.
const completeFinanceProject = async (req, res) => {
    try {
        const { _id, confirmOverride } = req.body;
        const project = await FinanceProject.findById(_id);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        if (project.status === 'completed') return res.json({ success: true, message: 'Already completed', data: project });
        if (project.status !== 'active') {
            return res.status(400).json({ success: false, message: 'Only an active project can be marked completed' });
        }

        const readiness = await getProjectCompletionReadiness(_id);
        if (readiness.hasBlockers && !confirmOverride) {
            return res.status(400).json({ success: false, message: 'This project has outstanding items', blockers: readiness.blockers });
        }

        project.status = 'completed';
        await project.save();

        // Cascade — mirrors this codebase's existing soft-delete-cascade
        // pattern (e.g. removeLabourPayment -> FinanceCashEntry,
        // removePurchase -> FinanceStockMovement), just triggered by a
        // status flip instead of a deletion. This is what actually frees
        // labourers/supervisors for reassignment: assertLabourersAvailable
        // (utils/labourAvailability.js) only looks for non-deleted
        // financeWorkLabourAssignment rows, so soft-deleting them here is
        // enough — no change needed to that check itself.
        const works = await FinanceWork.find({ projectId: _id, deleted: { $ne: true } }, '_id');
        const workIds = works.map(w => w._id);
        if (workIds.length) {
            await FinanceWork.updateMany({ _id: { $in: workIds } }, { status: 'completed' });
            const deletedBy = req.userName || 'Admin';
            await Promise.all([
                FinanceWorkLabourAssignment.updateMany(
                    { workId: { $in: workIds }, deleted: { $ne: true } },
                    { deleted: true, deletedAt: new Date(), deletedBy }
                ),
                // Contractor assignments get the same release for data
                // hygiene/consistency, even though no contractor-side
                // availability block exists to relieve — a contractor
                // brings a whole crew, not one physical person, so nothing
                // was blocking reassignment for them in the first place.
                FinanceWorkContractorAssignment.updateMany(
                    { workId: { $in: workIds }, deleted: { $ne: true } },
                    { deleted: true, deletedAt: new Date(), deletedBy }
                ),
            ]);
        }

        broadcast({ type: 'financeProjectsChanged' });
        broadcast({ type: 'financeWorksChanged', projectId: project._id });
        broadcast({ type: 'financeWorkLabourAssignmentsChanged', projectId: project._id });
        broadcast({ type: 'financeWorkContractorAssignmentsChanged', projectId: project._id });

        await logActivity({
            eventType: 'project_completed',
            entityType: 'financeProject',
            entityId: project._id,
            projectId: project._id,
            summary: readiness.hasBlockers
                ? `Project '${project.name}' marked completed (with ${readiness.blockers.length} outstanding item${readiness.blockers.length === 1 ? '' : 's'} overridden)`
                : `Project '${project.name}' marked completed`,
            req,
        });

        res.json({ success: true, message: 'Project marked completed', data: project });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error completing project' });
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

// Dedicated, fast lookup for the Assigned Supervisor conflict check
// (New Project wizard's Basic Info step) — GET /projects/list was being
// reused for this, but it recomputes activation-readiness (2 extra
// countDocuments queries) for every project in the company on every call,
// which made picking a supervisor feel slow for a check that only ever
// needed { name, status } for the handful of projects one specific
// employee is assignedSupervisorId on. Filtered server-side instead of
// fetching everything and filtering client-side.
const getSupervisorProjectConflicts = async (req, res) => {
    try {
        const { supervisorId, excludeProjectId } = req.query;
        if (!supervisorId) return res.status(400).json({ success: false, message: 'supervisorId is required' });
        const filter = {
            deleted: { $ne: true },
            assignedSupervisorId: supervisorId,
            status: { $ne: 'completed' },
        };
        if (excludeProjectId) filter._id = { $ne: excludeProjectId };
        const projects = await FinanceProject.find(filter, 'name assignedSupervisorId').populate('assignedSupervisorId', 'name');
        res.json({ success: true, data: projects });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error checking supervisor conflicts' });
    }
};

export {
    listFinanceProjects, getFinanceProject, addFinanceProject, updateFinanceProject,
    recordAdvanceInvoiced, recordAdvanceReceived, downloadAdvanceReceipt, updateReferralCommission, activateFinanceProject,
    getCompletionReadiness, completeFinanceProject, removeFinanceProject, getSupervisorProjectConflicts,
};
