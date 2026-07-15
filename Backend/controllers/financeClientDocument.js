import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import FinanceClientDocument from '../models/financeClientDocument.js';
import { broadcast } from '../middlewares/webSocket.js';

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const listClientDocuments = async (req, res) => {
    try {
        const { clientId } = req.query;
        const filter = { deleted: { $ne: true } };
        if (clientId) filter.clientId = clientId;
        const items = await FinanceClientDocument.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching documents' });
    }
};

const addClientDocument = async (req, res) => {
    try {
        const { clientId, name, notes } = req.body;
        if (!clientId) return res.status(400).json({ success: false, message: 'Client is required' });
        if (!req.file) return res.status(400).json({ success: false, message: 'A file is required' });

        let result;
        try {
            // resource_type 'auto' lets Cloudinary handle PDFs/docs alongside
            // images without a separate upload path for each.
            result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'client_documents',
                resource_type: 'auto',
            });
        } finally {
            fs.unlinkSync(req.file.path);
        }

        const item = new FinanceClientDocument({
            clientId, name: (name || req.file.originalname).trim(), fileUrl: result.secure_url, notes,
        });
        await item.save();

        broadcast({ type: 'financeClientDocumentsChanged' });
        res.json({ success: true, message: 'Document uploaded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message?.includes('Invalid') ? 'Unsupported or corrupted file' : 'Error uploading document' });
    }
};

const removeClientDocument = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceClientDocument.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeClientDocumentsChanged' });
        res.json({ success: true, message: `"${item.name}" removed` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing document' });
    }
};

export { listClientDocuments, addClientDocument, removeClientDocument };
