import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import '../../styles/list.css';

const IMAGE_URL_RE = /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i;
// PDFs served through the backend's own resolveDeliveryUrl (see
// uploadDocuments.js) come back as a Cloudinary Admin API download url —
// .../raw/download?...&public_id=folder%2Fname.pdf&type=upload&... — where
// ".pdf" sits inside a query *value*, not at the url's own path end, so
// this checks for ".pdf" followed by "?", "&", or end-of-string anywhere in
// the url rather than requiring it to be the final path segment.
const PDF_URL_RE = /\.pdf(\?|&|$)/i;

const EXT_MIME = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', pdf: 'application/pdf',
};

// Same "extension can be mid-querystring, not just at the path's end"
// reasoning as PDF_URL_RE above — scans the whole url rather than only the
// part before the first "?".
const guessMime = (url) => {
    const match = url.match(/\.([a-z0-9]+)(?:\?|&|$)/i);
    return (match && EXT_MIME[match[1].toLowerCase()]) || 'application/octet-stream';
};

/*
 * Drop-in replacement for the `<a href={url} target="_blank">View</a>`
 * pattern used everywhere a saved file (project document, person's ID
 * proof, quotation upload, payment attachment) needs a "View" trigger —
 * none of those upload inputs restrict file type, so a url can point at
 * an image, a PDF, a DOCX, anything. Images and PDFs both open in the
 * same in-page lightbox PhotosTab.jsx uses (lb-* classes, list.css)
 * instead of a new tab. Anything else (DOCX, XLSX, …) keeps the plain
 * new-tab behavior — there's no in-browser way to render those inline.
 * The <a> tag itself is always rendered (never swapped for a <button>)
 * so right-click/"open in new tab"/middle-click still work exactly as
 * before even when the plain click is intercepted.
 *
 * Both images and PDFs load as a blob rather than pointing straight at
 * the (cross-origin, Cloudinary-hosted) url — these project/quotation/
 * client documents all upload to Cloudinary as resource_type "raw"
 * (required to dodge an account-level ACL block Cloudinary applies to
 * PDFs/ZIPs uploaded as image/video — see financeProjectDocument.js),
 * and raw delivery doesn't reliably serve a real, format-specific
 * Content-Type — generic application/octet-stream instead in practice —
 * which is enough on its own for a browser's embedded PDF viewer to
 * refuse the file, and can be enough for an <img> to render blank too,
 * before any cross-origin question even comes up. The blob is rebuilt
 * here with an explicit type guessed from the file's own extension
 * (guessMime) for exactly that reason, then turned into a same-origin
 * blob: URL — sidesteps both the wrong-Content-Type and any cross-origin
 * embedding restriction at once, for either media type. Falls back to a
 * plain "open in a new tab" link if the fetch itself fails, rather than
 * a dead-end blank box.
 */
const ViewAttachmentLink = ({ url, name, className, style, children = 'View' }) => {
    const [open, setOpen] = useState(false);
    const [blobUrl, setBlobUrl] = useState(null);
    const [blobError, setBlobError] = useState(false);
    const isImage = url ? IMAGE_URL_RE.test(url) : false;
    const isPdf = url ? PDF_URL_RE.test(url) : false;
    const previewable = isImage || isPdf;

    useEffect(() => {
        if (!open) return;
        document.body.style.overflow = 'hidden';
        const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', handleKey);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    useEffect(() => {
        if (!open || !previewable) return;
        let cancelled = false;
        let objectUrl = null;
        setBlobError(false);
        fetch(url)
            .then(res => { if (!res.ok) throw new Error('fetch failed'); return res.arrayBuffer(); })
            .then(buf => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(new Blob([buf], { type: guessMime(url) }));
                setBlobUrl(objectUrl);
            })
            .catch(() => { if (!cancelled) setBlobError(true); });
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            setBlobUrl(null);
        };
    }, [open, previewable, url]);

    if (!url) return null;

    const handleClick = (e) => {
        if (!previewable) return; // let the browser handle these natively
        e.preventDefault();
        setOpen(true);
    };

    return (
        <>
            <a href={url} target="_blank" rel="noreferrer" onClick={handleClick} className={className} style={style}>
                {children}
            </a>
            {open && ReactDOM.createPortal(
                <div className="lb-overlay" onClick={() => setOpen(false)}>
                    <button className="lb-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
                    <div className={isPdf ? 'lb-img-wrap lb-pdf-wrap' : 'lb-img-wrap'} onClick={e => e.stopPropagation()}>
                        {blobError ? (
                            <div className="lb-pdf-status">
                                <p>This file could not be previewed here.</p>
                                <a href={url} target="_blank" rel="noreferrer">Open in a new tab instead</a>
                            </div>
                        ) : !blobUrl ? (
                            <div className="lb-pdf-status">Loading…</div>
                        ) : isPdf ? (
                            <iframe src={blobUrl} title={name || 'Document'} className="lb-pdf" />
                        ) : (
                            <img src={blobUrl} alt={name || 'Attachment'} className="lb-img" />
                        )}
                        {name && (
                            <div className="lb-caption">
                                <span className="lb-name">{name}</span>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default ViewAttachmentLink;
