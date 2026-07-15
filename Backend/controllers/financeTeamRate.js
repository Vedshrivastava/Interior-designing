import FinanceTeamRate from '../models/financeTeamRate.js';
import FinanceWork from '../models/financeWork.js';
import { broadcast } from '../middlewares/webSocket.js';

const listTeamRates = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required' });
        const items = await FinanceTeamRate.find({ projectId, deleted: { $ne: true } })
            .populate('teamId', 'name')
            .sort({ workType: 1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching team rates' });
    }
};

const addTeamRate = async (req, res) => {
    try {
        const { projectId, teamId, workType, paymentBasis, ratePerSqft, ratePerDay } = req.body;
        if (!projectId || !teamId || !workType) {
            return res.status(400).json({ success: false, message: 'Project, team, and work type are required' });
        }
        if (!['per_sqft', 'per_day'].includes(paymentBasis)) {
            return res.status(400).json({ success: false, message: 'A valid payment basis is required' });
        }
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
        const existing = await FinanceTeamRate.findOne({ projectId, teamId, workType, deleted: { $ne: true } });
        if (existing) return res.status(400).json({ success: false, message: 'This team already has a rate for this work type on this project' });

        const item = new FinanceTeamRate({
            projectId, teamId, workType, paymentBasis,
            ratePerSqft: Number(ratePerSqft) || 0,
            ratePerDay: Number(ratePerDay) || 0,
        });
        await item.save();
        broadcast({ type: 'financeTeamRatesChanged', projectId });
        res.json({ success: true, message: 'Team rate added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding team rate' });
    }
};

const removeTeamRate = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceTeamRate.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeTeamRatesChanged', projectId: item.projectId });
        res.json({ success: true, message: 'Team rate removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing team rate' });
    }
};

export { listTeamRates, addTeamRate, removeTeamRate };
