import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';
import FinanceMeasurement from '../models/financeMeasurement.js';
import FinanceWork from '../models/financeWork.js';
import FinanceProject from '../models/financeProject.js';
import FinanceStockMovement from '../models/financeStockMovement.js';
import FinanceWorkContractorAssignment from '../models/financeWorkContractorAssignment.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const listMeasurements = async (req, res) => {
    try {
        const { projectId, workId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const filter = { projectId, deleted: { $ne: true } };
        if (workId) filter.workId = workId;
        const items = await FinanceMeasurement.find(filter)
            .populate('workId', 'workType workOrderNumber')
            .populate('materialUsed.materialId', 'name unit')
            .populate('contractorVendorId', 'name')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching measurements' });
    }
};

/*
 * The whole Site Operations / Site Inventory automation lives here:
 *   1. Increment the parent Work's completedAreaSqft.
 *   2. If the project tracks material and materialUsed is non-empty, create
 *      one `consume` stock movement per material line.
 *   3. Broadcast financeMeasurementsChanged + financeWorksChanged (+
 *      financeStockChanged if movements were created).
 * Nothing here writes a stored "progress %" or "earnings" field — both are
 * computed on read from completedAreaSqft + the existing rate tables.
 */
const addMeasurement = async (req, res) => {
    try {
        const { projectId, workId, date, contractorVendorId, supervisorName, remarks } = req.body;
        const areaCoveredSqft = Number(req.body.areaCoveredSqft);

        if (!projectId || !workId || !date) {
            return res.status(400).json({ success: false, message: 'Project, work, and date are required' });
        }
        if (!contractorVendorId) return res.status(400).json({ success: false, message: 'Contractor is required' });
        if (!areaCoveredSqft || areaCoveredSqft <= 0) {
            return res.status(400).json({ success: false, message: 'Area covered must be greater than zero' });
        }

        const work = await FinanceWork.findOne({ _id: workId, projectId, deleted: { $ne: true } });
        if (!work) return res.status(404).json({ success: false, message: "Work not found for this project" });

        const isAssigned = await FinanceWorkContractorAssignment.exists({ workId, contractorVendorId, deleted: { $ne: true } });
        if (!isAssigned) {
            return res.status(400).json({ success: false, message: 'Contractor is not assigned to this work' });
        }

        const project = await FinanceProject.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        // materialUsed arrives as a JSON string over multipart/form-data,
        // same convention as `points`/`subcategories` on design.js.
        let materialUsed = [];
        if (req.body.materialUsed) {
            try { materialUsed = JSON.parse(req.body.materialUsed); } catch { materialUsed = []; }
        }
        materialUsed = Array.isArray(materialUsed)
            ? materialUsed.filter(m => m && m.materialId && Number(m.quantity) > 0).map(m => ({ materialId: m.materialId, quantity: Number(m.quantity) }))
            : [];
        if (!project.materialTrackingEnabled) materialUsed = [];

        // Photos → Cloudinary, same pattern as design/product image uploads.
        let photoUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const result = await cloudinary.uploader.upload(file.path, { folder: 'measurement_photos' });
                    photoUrls.push(result.secure_url);
                    fs.unlinkSync(file.path);
                } catch (uploadError) {
                    console.error(`Error uploading file ${file.path}:`, uploadError);
                }
            }
        }

        const measurement = new FinanceMeasurement({
            projectId, workId, date, contractorVendorId, areaCoveredSqft,
            supervisorName: supervisorName || '',
            materialUsed,
            photos: photoUrls,
            remarks: remarks || '',
        });
        await measurement.save();

        await FinanceWork.findByIdAndUpdate(workId, { $inc: { completedAreaSqft: areaCoveredSqft } });

        let stockChanged = false;
        if (materialUsed.length > 0) {
            await FinanceStockMovement.insertMany(materialUsed.map(m => ({
                projectId, materialId: m.materialId, movementType: 'consume',
                quantity: m.quantity, date, relatedMeasurementId: measurement._id, workId,
            })));
            stockChanged = true;
        }

        broadcast({ type: 'financeMeasurementsChanged', projectId });
        broadcast({ type: 'financeWorksChanged', projectId });
        if (stockChanged) broadcast({ type: 'financeStockChanged', projectId });

        await logActivity({
            eventType: 'measurement_logged',
            entityType: 'financeMeasurement',
            entityId: measurement._id,
            projectId,
            summary: `${supervisorName || 'Supervisor'} logged ${areaCoveredSqft} sqft for ${work.workType} at ${project.name}`,
            req,
        });

        res.json({ success: true, message: 'Measurement saved', data: measurement });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error saving measurement' });
    }
};

// Deliberately does not accept areaCoveredSqft or materialUsed — editing
// either would silently desync the work's completedAreaSqft and the stock
// ledger from what this measurement already applied. Remove and re-add
// instead if a quantity was entered wrong.
const updateMeasurement = async (req, res) => {
    try {
        const { _id, supervisorName, remarks, engineerApproved } = req.body;
        const existing = await FinanceMeasurement.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Measurement not found' });

        const update = {
            supervisorName: supervisorName ?? existing.supervisorName,
            remarks: remarks ?? existing.remarks,
        };
        if (typeof engineerApproved === 'boolean' && engineerApproved !== existing.engineerApproved) {
            update.engineerApproved = engineerApproved;
            update.engineerApprovedAt = engineerApproved ? new Date() : null;
            update.engineerApprovedBy = engineerApproved ? (req.userName || 'Admin') : '';
        }

        await FinanceMeasurement.findByIdAndUpdate(_id, update);
        broadcast({ type: 'financeMeasurementsChanged', projectId: existing.projectId });
        res.json({ success: true, message: 'Measurement updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating measurement' });
    }
};

// Soft-delete, but unlike most resources in this codebase this one DOES
// reverse what it created — leaving the work's completedAreaSqft and its
// consume movements stale would silently corrupt progress % and stock
// levels. Blocked entirely once the measurement has been billed (part of
// an issued running bill) — reversing it then would corrupt that document
// instead; the bill needs to be voided/reversed first (not built here).
const removeMeasurement = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceMeasurement.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        if (item.billedInRunningBillId) {
            return res.status(400).json({ success: false, message: "This measurement is part of an issued running bill — void or reverse that bill before deleting it" });
        }

        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();

        await FinanceWork.findByIdAndUpdate(item.workId, { $inc: { completedAreaSqft: -item.areaCoveredSqft } });

        const deletedBy = req.userName || 'Admin';
        const movementResult = await FinanceStockMovement.updateMany(
            { relatedMeasurementId: item._id, deleted: { $ne: true } },
            { deleted: true, deletedAt: new Date(), deletedBy }
        );
        const stockChanged = movementResult.modifiedCount > 0;

        broadcast({ type: 'financeMeasurementsChanged', projectId: item.projectId });
        broadcast({ type: 'financeWorksChanged', projectId: item.projectId });
        if (stockChanged) broadcast({ type: 'financeStockChanged', projectId: item.projectId });

        await logActivity({
            eventType: 'measurement_deleted',
            entityType: 'financeMeasurement',
            entityId: item._id,
            projectId: item.projectId,
            summary: `Measurement of ${item.areaCoveredSqft} sqft removed`,
            amount: null,
            req,
        });

        res.json({ success: true, message: 'Measurement moved to recovery bin' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing measurement' });
    }
};

export { listMeasurements, addMeasurement, updateMeasurement, removeMeasurement };
