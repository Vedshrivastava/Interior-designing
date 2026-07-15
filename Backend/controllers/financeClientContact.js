import FinanceClientContact from '../models/financeClientContact.js';
import { broadcast } from '../middlewares/webSocket.js';

const listClientContacts = async (req, res) => {
    try {
        const { clientId } = req.query;
        const filter = { deleted: { $ne: true } };
        if (clientId) filter.clientId = clientId;
        const items = await FinanceClientContact.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching contacts' });
    }
};

const addClientContact = async (req, res) => {
    try {
        const { clientId, name, designation, phone, email, notes } = req.body;
        if (!clientId) return res.status(400).json({ success: false, message: 'Client is required' });
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const item = new FinanceClientContact({ clientId, name: name.trim(), designation, phone, email, notes });
        await item.save();
        broadcast({ type: 'financeClientContactsChanged' });
        res.json({ success: true, message: 'Contact added', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error adding contact' });
    }
};

const updateClientContact = async (req, res) => {
    try {
        const { _id, name, designation, phone, email, notes } = req.body;
        const existing = await FinanceClientContact.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Contact not found' });
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        await FinanceClientContact.findByIdAndUpdate(_id, { name: name.trim(), designation, phone, email, notes });
        broadcast({ type: 'financeClientContactsChanged' });
        res.json({ success: true, message: 'Contact updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating contact' });
    }
};

const removeClientContact = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceClientContact.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeClientContactsChanged' });
        res.json({ success: true, message: `"${item.name}" removed` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing contact' });
    }
};

export { listClientContacts, addClientContact, updateClientContact, removeClientContact };
