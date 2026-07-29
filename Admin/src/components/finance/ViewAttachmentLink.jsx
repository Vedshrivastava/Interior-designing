import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import '../../styles/list.css';

const IMAGE_URL_RE = /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i;

/*
 * Drop-in replacement for the `<a href={url} target="_blank">View</a>`
 * pattern used everywhere a saved file (project document, person's ID
 * proof, quotation upload, payment attachment) needs a "View" trigger —
 * none of those upload inputs restrict file type, so a url can point at
 * an image, a PDF, a DOCX, anything. Images open in the same lightbox
 * PhotosTab.jsx uses (lb-* classes, list.css) instead of a new tab, for
 * visual consistency with how site photos are viewed; everything else
 * keeps the plain new-tab behavior a lightbox can't render anyway. The
 * <a> tag itself is always rendered (never swapped for a <button>) so
 * right-click/"open in new tab"/middle-click still work exactly as
 * before even for images — only the plain left-click is intercepted.
 */
const ViewAttachmentLink = ({ url, name, className, style, children = 'View' }) => {
    const [open, setOpen] = useState(false);
    const isImage = url ? IMAGE_URL_RE.test(url) : false;

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

    if (!url) return null;

    const handleClick = (e) => {
        if (!isImage) return; // let the browser handle non-images natively
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
                    <div className="lb-img-wrap" onClick={e => e.stopPropagation()}>
                        <img src={url} alt={name || 'Attachment'} className="lb-img" />
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
