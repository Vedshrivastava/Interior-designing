import FinanceLabourRate from '../models/financeLabourRate.js';
import FinanceLabourer from '../models/financeLabourer.js';
import FinanceWork from '../models/financeWork.js';
import { broadcast } from '../middlewares/webSocket.js';

const listLabourRates = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const items = await FinanceLabourRate.find({ projectId, deleted: { $ne: true } })
            .populate('labourerId', 'name')
            .sort({ workType: 1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching labour rates' });
    }
};

const addLabourRate = async (req, res) => {
    try {
        const { projectId, labourerId, workType, ratePerSqft } = req.body;
        if (!projectId || !labourerId || !workType) {
            return res.status(400).json({ success: false, message: 'Project, labourer, and work type are required' });
        }
        if (!ratePerSqft || Number(ratePerSqft) <= 0) {
            return res.status(400).json({ success: false, message: 'Rate must be greater than zero' });
        }
        const labourer = await FinanceLabourer.findOne({ _id: labourerId, deleted: { $ne: true } });
        if (!labourer) return res.status(404).json({ success: false, message: 'Labourer not found' });

        // Same fallback reasoning as financeContractorRate.addContractorRate —
        // the wizard/setup flow can set rates before any Work exists.
        const projectHasAnyWork = await FinanceWork.exists({ projectId, deleted: { $ne: true } });
        if (projectHasAnyWork) {
            const workExists = await FinanceWork.exists({ projectId, workType, deleted: { $ne: true } });
            if (!workExists) {
                return res.status(400).json({ success: false, message: `No Work with type "${workType}" exists on this project yet — add the Work first` });
            }
        }
        const existing = await FinanceLabourRate.findOne({ projectId, labourerId, workType, deleted: { $ne: true } });
        if (existing) return res.status(400).json({ success: false, message: 'This labourer already has a rate for this work type on this project' });

        const item = new FinanceLabourRate({ projectId, labourerId, workType, ratePerSqft: Number(ratePerSqft) });
        await item.save();
        broadcast({ type: 'financeLabourRatesChanged', projectId });
        res.json({ success: true, message: 'Labour rate added', data: item });
    } catch (err) {
        console.error(err);
        res.status(err.message?.includes('not') ? 400 : 500).json({ success: false, message: err.message || 'Error adding labour rate' });
    }
};

const removeLabourRate = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceLabourRate.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeLabourRatesChanged', projectId: item.projectId });
        res.json({ success: true, message: 'Labour rate removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing labour rate' });
    }
};

export { listLabourRates, addLabourRate, removeLabourRate };
