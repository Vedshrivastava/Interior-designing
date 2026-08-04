import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

// Every raw file (PDF, DOCX, ZIP, …) in this app uploads through this one
// function — resource_type 'raw' (not 'auto'/'image') because Cloudinary
// blocks public delivery of PDF/ZIP files uploaded under the image/video
// delivery type by default. Cloudinary's "authenticated" delivery type
// fixes public ("upload" type) raw delivery being blocked for non-PDF
// files (confirmed directly: a plain image uploaded raw/upload 401s the
// same way a PDF does; raw/authenticated + a signed url resolves it, no
// expiry issue — a signed CDN url with no start_time/duration is
// permanently storable). PDFs specifically are still blocked even under
// authenticated delivery — this account's "restricted PDF/ZIP delivery"
// policy turned out to apply regardless of delivery type or url flags
// (tried fl_attachment too), confirmed against the real account. See
// resolveDeliveryUrl below for how PDFs are actually served.
export const uploadRawFile = async (filePath, folder) => {
    const result = await cloudinary.uploader.upload(filePath, {
        folder, resource_type: 'raw', type: 'authenticated',
    });
    return cloudinary.url(result.public_id, {
        resource_type: 'raw', type: 'authenticated', sign_url: true, version: result.version,
    });
};

// A signed delivery url (sign_url: true, as uploadRawFile always uses)
// inserts a `s--<signature>--/` path segment between `type` and the
// `v<version>/` segment — e.g. `.../raw/authenticated/s--CzkCUNTE--/
// v1785871565/expense_attachments/name.pdf`. The signature segment was
// missing from this regex entirely, so it fell through into the greedy
// `(.+)$` capture along with the version and (once a real query string
// showed up) the query string too — every public_id extracted here was
// wrong, every `private_download_url` call below built with it 404'd
// ("Resource not found"), and every PDF attachment in the app (expenses,
// contractor/vendor payments, project/client documents, quotations —
// anywhere resolveDeliveryUrl runs) failed to open. Fixed to skip the
// signature segment explicitly, and to stop the public_id capture at `?`
// so a query string can never leak into it either.
const CLOUDINARY_URL_RE = /res\.cloudinary\.com\/[^/]+\/([a-z]+)\/([a-z]+)\/(?:s--[^/]+--\/)?(?:v\d+\/)?([^?]+)/i;
const PDF_URL_RE = /\.pdf(\?.*)?$/i;

// PDFs can't be served via the normal public/authenticated CDN delivery url
// at all on this account (see uploadRawFile's comment) — the one thing that
// does work is Cloudinary's Admin API download mechanism
// (api.cloudinary.com, authenticated by this server's own API key/secret,
// a completely different code path from the public CDN's delivery ACL).
// Unlike a signed CDN delivery url, this one is signed with a timestamp the
// same way every other Cloudinary Admin API call is — it can't be generated
// once at upload time and stored, so this runs fresh, per request, right
// before a document list response goes out, rather than living in
// uploadRawFile above. Every non-PDF url (images, either freshly-uploaded
// raw/authenticated ones or any legacy url) passes through unchanged.
export const resolveDeliveryUrl = (storedUrl) => {
    if (!storedUrl || !PDF_URL_RE.test(storedUrl)) return storedUrl;
    const match = storedUrl.match(CLOUDINARY_URL_RE);
    if (!match) return storedUrl;
    const [, resourceType, type, publicId] = match;
    try {
        return cloudinary.utils.private_download_url(publicId, null, { resource_type: resourceType, type });
    } catch {
        return storedUrl;
    }
};

// Same idea as resolveDeliveryUrl, applied across a documents:[{url,note}]
// array — shared by every model whose own "Documents" tab uses that shape
// (Labourer, Labour Provider, Employee, Referral, Vendor).
export const resolveDocumentUrls = (documents) =>
    (documents || []).map(d => {
        const plain = typeof d.toObject === 'function' ? d.toObject() : d;
        return { ...plain, url: resolveDeliveryUrl(plain.url) };
    });

// Uploads each file to Cloudinary and pairs it with its note from `notes`
// (same order as `files`) — shared by both Contractor and Labour
// measurement uploads, which use this exact "documents with notes" shape.
export const uploadDocumentsWithNotes = async (files, notes, folder) => {
    const documents = [];
    if (!files || files.length === 0) return documents;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const url = await uploadRawFile(file.path, folder);
            documents.push({ url, note: notes[i] || '' });
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
