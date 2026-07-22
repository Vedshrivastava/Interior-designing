import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Uploads each file to Cloudinary and pairs it with its note from `notes`
// (same order as `files`) — shared by both Contractor and Labour
// measurement uploads, which use this exact "documents with notes" shape.
// resource_type 'raw' (not 'auto'/'image') because Cloudinary blocks public
// delivery of PDF/ZIP files uploaded under the image/video delivery type by
// default (account-level "restricted media types" security policy) — raw
// delivery serves the file as-is and isn't subject to that ACL block.
export const uploadDocumentsWithNotes = async (files, notes, folder) => {
    const documents = [];
    if (!files || files.length === 0) return documents;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const result = await cloudinary.uploader.upload(file.path, { folder, resource_type: 'raw' });
            documents.push({ url: result.secure_url, note: notes[i] || '' });
        } catch (uploadError) {
            console.error(`Error uploading file ${file.path}:`, uploadError);
        } finally {
            fs.unlinkSync(file.path);
        }
    }
    return documents;
};

// Shared "add one document to an existing person" action — Labourer,
// Vendor (Contractor), and Employee (Supervisor) records all carry the
// same `documents: [{url, note}]` shape and get it filled in identically
// from their respective "Documents" tab in the People pages, not just at
// creation time like uploadDocumentsWithNotes above already covers.
export const addDocumentToRecord = async (Model, id, file, note, folder) => {
    const item = await Model.findById(id);
    if (!item) return null;
    if (!file) return item;
    const [doc] = await uploadDocumentsWithNotes([file], [note], folder);
    if (doc) { item.documents.push(doc); await item.save(); }
    return item;
};

export const removeDocumentFromRecord = async (Model, id, documentId) => {
    const item = await Model.findById(id);
    if (!item) return null;
    item.documents = item.documents.filter(d => d._id.toString() !== documentId);
    await item.save();
    return item;
};
