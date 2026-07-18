import FinanceClient from '../models/financeClient.js';
import { broadcast } from '../middlewares/webSocket.js';

const listFinanceClients = async (req, res) => {
    try {
        const items = await FinanceClient.find({ deleted: { $ne: true } }).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching clients' });
    }
};

const addFinanceClient = async (req, res) => {
    try {
        const { name, phone, email, address, gstNumber, accountName, bankName, accountNumber, ifscCode, notes } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!accountName || !bankName || !accountNumber || !ifscCode) {
            return res.status(400).json({ success: false, message: 'Bank account holder name, bank name, account number, and IFSC code are all required' });
        }
        const item = new FinanceClient({
            name: name.trim(), phone, email, address, gstNumber,
            accountName, bankName, accountNumber, ifscCode, notes,
        });
        await item.save();
        broadcast({ type: 'financeClientsChanged' });
        res.json({ success: true, message: 'Client added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding client' });
    }
};

const updateFinanceClient = async (req, res) => {
    try {
        const { _id, name, phone, email, address, gstNumber, accountName, bankName, accountNumber, ifscCode, notes } = req.body;
        const existing = await FinanceClient.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Client not found' });
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!accountName || !bankName || !accountNumber || !ifscCode) {
            return res.status(400).json({ success: false, message: 'Bank account holder name, bank name, account number, and IFSC code are all required' });
        }
        await FinanceClient.findByIdAndUpdate(_id, {
            name: name.trim(), phone, email, address, gstNumber,
            accountName, bankName, accountNumber, ifscCode, notes,
        });
        broadcast({ type: 'financeClientsChanged' });
        res.json({ success: true, message: 'Client updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating client' });
    }
};

const removeFinanceClient = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceClient.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeClientsChanged' });
        res.json({ success: true, message: `"${item.name}" moved to recovery bin` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing client' });
    }
};

export { listFinanceClients, addFinanceClient, updateFinanceClient, removeFinanceClient };
