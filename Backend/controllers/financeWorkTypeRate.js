import FinanceWorkTypeRate from '../models/financeWorkTypeRate.js';
import { broadcast } from '../middlewares/webSocket.js';

const listWorkTypeRates = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const items = await FinanceWorkTypeRate.find({ projectId, deleted: { $ne: true } }).sort({ workType: 1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching work type rates' });
    }
};

const addWorkTypeRate = async (req, res) => {
    try {
        const { projectId, workType, clientRatePerSqft, referralRatePerSqft } = req.body;
        if (!projectId || !workType) return res.status(400).json({ success: false, message: 'Project and work type are required' });
        if (clientRatePerSqft === undefined || clientRatePerSqft === null || clientRatePerSqft === '') {
            return res.status(400).json({ success: false, message: 'Client rate is required' });
        }
        const existing = await FinanceWorkTypeRate.findOne({ projectId, workType, deleted: { $ne: true } });
        if (existing) return res.status(400).json({ success: false, message: `A rate for "${workType}" already exists on this project` });

        const item = new FinanceWorkTypeRate({
            projectId, workType,
            clientRatePerSqft: Number(clientRatePerSqft),
            referralRatePerSqft: Number(referralRatePerSqft) || 0,
        });
        await item.save();
        broadcast({ type: 'financeWorkTypeRatesChanged', projectId });
        res.json({ success: true, message: 'Work type rate added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding work type rate' });
    }
};

const removeWorkTypeRate = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceWorkTypeRate.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeWorkTypeRatesChanged', projectId: item.projectId });
        res.json({ success: true, message: `Rate for "${item.workType}" removed` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing work type rate' });
    }
};

export { listWorkTypeRates, addWorkTypeRate, removeWorkTypeRate };
