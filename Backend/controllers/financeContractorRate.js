import FinanceContractorRate from '../models/financeContractorRate.js';
import FinanceWork from '../models/financeWork.js';
import { assertContractorVendor } from '../utils/contractorVendor.js';
import { broadcast } from '../middlewares/webSocket.js';

const listContractorRates = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const items = await FinanceContractorRate.find({ projectId, deleted: { $ne: true } })
            .populate('contractorVendorId', 'name')
            .sort({ workType: 1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching contractor rates' });
    }
};

const addContractorRate = async (req, res) => {
    try {
        const { projectId, contractorVendorId, workType, paymentBasis, ratePerSqft, ratePerDay } = req.body;
        if (!projectId || !contractorVendorId || !workType) {
            return res.status(400).json({ success: false, message: 'Project, contractor, and work type are required' });
        }
        if (!['per_sqft', 'per_day'].includes(paymentBasis)) {
            return res.status(400).json({ success: false, message: 'A valid payment basis is required' });
        }
        await assertContractorVendor(contractorVendorId);

        // A rate only makes sense for a work type this project actually has
        // a Work for — but the New Project wizard sets these rates before
        // any Work exists, so this only enforces once the project has at
        // least one real Work (mirrors the frontend picker's fallback).
        const projectHasAnyWork = await FinanceWork.exists({ projectId, deleted: { $ne: true } });
        if (projectHasAnyWork) {
            const workExists = await FinanceWork.exists({ projectId, workType, deleted: { $ne: true } });
            if (!workExists) {
                return res.status(400).json({ success: false, message: `No Work with type "${workType}" exists on this project yet — add the Work first` });
            }
        }
        const existing = await FinanceContractorRate.findOne({ projectId, contractorVendorId, workType, deleted: { $ne: true } });
        if (existing) return res.status(400).json({ success: false, message: 'This contractor already has a rate for this work type on this project' });

        const item = new FinanceContractorRate({
            projectId, contractorVendorId, workType, paymentBasis,
            ratePerSqft: Number(ratePerSqft) || 0,
            ratePerDay: Number(ratePerDay) || 0,
        });
        await item.save();
        broadcast({ type: 'financeContractorRatesChanged', projectId });
        res.json({ success: true, message: 'Contractor rate added', data: item });
    } catch (err) {
        console.error(err);
        res.status(err.message?.includes('not') ? 400 : 500).json({ success: false, message: err.message || 'Error adding contractor rate' });
    }
};

const removeContractorRate = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceContractorRate.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeContractorRatesChanged', projectId: item.projectId });
        res.json({ success: true, message: 'Contractor rate removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing contractor rate' });
    }
};

export { listContractorRates, addContractorRate, removeContractorRate };
