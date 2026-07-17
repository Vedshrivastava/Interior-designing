import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Uploads each file to Cloudinary (resource_type 'auto' so PDFs and other
// document types work alongside images, not just camera photos) and pairs
// it with its note from `notes` (same order as `files`) — shared by both
// Contractor and Labour measurement uploads, which use this exact
// "documents with notes" shape.
export const uploadDocumentsWithNotes = async (files, notes, folder) => {
    const documents = [];
    if (!files || files.length === 0) return documents;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const result = await cloudinary.uploader.upload(file.path, { folder, resource_type: 'auto' });
            documents.push({ url: result.secure_url, note: notes[i] || '' });
        } catch (uploadError) {
            console.error(`Error uploading file ${file.path}:`, uploadError);
        } finally {
            fs.unlinkSync(file.path);
        }
    }
    return documents;
};
