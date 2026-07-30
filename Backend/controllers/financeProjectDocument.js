import fs from 'fs';
import FinanceProjectDocument from '../models/financeProjectDocument.js';
import { broadcast } from '../middlewares/webSocket.js';
import { uploadRawFile, resolveDeliveryUrl } from '../utils/uploadDocuments.js';

const listProjectDocuments = async (req, res) => {
    try {
        const { projectId } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        const items = await FinanceProjectDocument.find(filter).sort({ createdAt: -1 }).lean();
        // PDFs are re-signed fresh here (resolveDeliveryUrl) rather than
        // once at upload time — see its own comment in uploadDocuments.js.
        const data = items.map(item => ({ ...item, fileUrl: resolveDeliveryUrl(item.fileUrl) }));
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching documents' });
    }
};

const addProjectDocument = async (req, res) => {
    try {
        const { projectId, name, notes, quotationId } = req.body;
        if (!projectId) return res.status(400).json({ success: false, message: 'Project is required' });
        if (!req.file) return res.status(400).json({ success: false, message: 'A file is required' });

        let fileUrl;
        try {
            fileUrl = await uploadRawFile(req.file.path, 'project_documents');
        } finally {
            fs.unlinkSync(req.file.path);
        }

        const item = new FinanceProjectDocument({
            projectId, name: (name || req.file.originalname).trim(), fileUrl, notes,
            quotationId: quotationId || null,
        });
        await item.save();

        broadcast({ type: 'financeProjectDocumentsChanged', quotationId: quotationId || null });
        res.json({ success: true, message: 'Document uploaded', data: item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message?.includes('Invalid') ? 'Unsupported or corrupted file' : 'Error uploading document' });
    }
};

const removeProjectDocument = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinanceProjectDocument.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        broadcast({ type: 'financeProjectDocumentsChanged' });
        res.json({ success: true, message: `"${item.name}" removed` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing document' });
    }
};

export { listProjectDocuments, addProjectDocument, removeProjectDocument };
