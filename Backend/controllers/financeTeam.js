import FinanceTeam from '../models/financeTeam.js';
import { broadcast } from '../middlewares/webSocket.js';

const listFinanceTeams = async (req, res) => {
    try {
        const items = await FinanceTeam.find({ deleted: { $ne: true } })
            .populate('contractorVendorId', 'name')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching teams' });
    }
};

const addFinanceTeam = async (req, res) => {
    try {
        const { name, contractorVendorId, notes } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const item = new FinanceTeam({
            name: name.trim(),
            contractorVendorId: contractorVendorId || null,
            notes,
        });
        await item.save();
        broadcast({ type: 'financeTeamsChanged' });
        res.json({ success: true, message: 'Team added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding team' });
    }
};

const updateFinanceTeam = async (req, res) => {
    try {
        const { _id, name, contractorVendorId, notes } = req.body;
        const existing = await FinanceTeam.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Team not found' });
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        await FinanceTeam.findByIdAndUpdate(_id, {
            name: name.trim(),
            contractorVendorId: contractorVendorId || null,
            notes,
        });
        broadcast({ type: 'financeTeamsChanged' });
        res.json({ success: true, message: 'Team updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating team' });
    }
};

const removeFinanceTeam = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceTeam.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeTeamsChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing team' });
    }
};

export { listFinanceTeams, addFinanceTeam, updateFinanceTeam, removeFinanceTeam };
