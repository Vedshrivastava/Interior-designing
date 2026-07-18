import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

/*
 * Site photos for a project — a gallery, distinct from the Documents tab
 * (a file list with no image preview). Add-only, newest first, no
 * reordering — this is a record of the site over time, not a curated
 * showcase, so display order doesn't carry meaning the way it does for the
 * public-site Design gallery this borrows its lightbox pattern from
 * (ListDesigns.jsx's `lb-*` classes, already available via list.css).
 */
const PhotosTab = ({ url, projectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [files, setFiles] = useState([]);
    const [caption, setCaption] = useState('');
    const [uploading, setUploading] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [lightbox, setLightbox] = useState({ open: false, index: 0 });

    const fetchPhotos = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/project-photos/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setPhotos(res.data.data);
        } catch { toast.error('Error fetching photos'); }
        finally { setLoading(false); }
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchPhotos(); }, [fetchPhotos]);
    useFinanceWsRefresh(['financeProjectPhotosChanged'], fetchPhotos);

    const openUpload = () => { setFiles([]); setCaption(''); setUploadOpen(true); };
    const closeUpload = () => setUploadOpen(false);

    const submitUpload = async (e) => {
        e.preventDefault();
        if (!files.length) return toast.error('Select at least one photo');
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('projectId', projectId);
            formData.append('caption', caption);
            files.forEach(f => formData.append('images', f));
            const res = await axios.post(`${url}/api/finance/project-photos/add`, formData, authHeader);
            if (res.data.success) { toast.success(res.data.message); closeUpload(); await fetchPhotos(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error uploading photos'); }
        finally { setUploading(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.post(`${url}/api/finance/project-photos/remove`, { _id: confirmItem._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchPhotos(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing photo'); }
        finally { setDeleting(false); }
    };

    const openLightbox = (idx) => { setLightbox({ open: true, index: idx }); document.body.style.overflow = 'hidden'; };
    const closeLightbox = () => { setLightbox({ open: false, index: 0 }); document.body.style.overflow = ''; };
    const lbPrev = (e) => { e.stopPropagation(); setLightbox(prev => ({ ...prev, index: (prev.index - 1 + photos.length) % photos.length })); };
    const lbNext = (e) => { e.stopPropagation(); setLightbox(prev => ({ ...prev, index: (prev.index + 1) % photos.length })); };

    useEffect(() => {
        if (!lightbox.open) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') setLightbox(prev => ({ ...prev, index: (prev.index - 1 + photos.length) % photos.length }));
            if (e.key === 'ArrowRight') setLightbox(prev => ({ ...prev, index: (prev.index + 1) % photos.length }));
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [lightbox.open, photos.length]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button type="button" className="add-btn" onClick={openUpload}>+ Add Photos</button>
            </div>

            {photos.length === 0 ? (
                <div className="admin-empty-state"><p>No site photos on file for this project yet.</p></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '14px' }}>
                    {photos.map((p, idx) => (
                        <div key={p._id} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '1' }}>
                            <img
                                src={p.imageUrl} alt={p.caption || 'Site photo'} onClick={() => openLightbox(idx)}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                            />
                            <button
                                type="button" className="remove-point-btn"
                                style={{ position: 'absolute', top: '6px', right: '6px' }}
                                onClick={() => setConfirmItem(p)}
                            >X</button>
                        </div>
                    ))}
                </div>
            )}

            {uploadOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Add Photos</h2>
                        <form onSubmit={submitUpload}>
                            <div className="add-product-name flex-col wizard-field-full">
                                <p>Photos *</p>
                                <input type="file" accept="image/*" multiple onChange={e => setFiles([...e.target.files])} />
                            </div>
                            <div className="add-product-name flex-col wizard-field-full">
                                <p>Caption (optional)</p>
                                <input type="text" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Applies to every photo in this upload" />
                            </div>
                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={closeUpload}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove Photo?</h3>
                        <p className="bin-confirm-warning">This can't be undone from here.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {lightbox.open && photos[lightbox.index] && ReactDOM.createPortal(
                <div className="lb-overlay" onClick={closeLightbox}>
                    <button className="lb-close" onClick={closeLightbox} aria-label="Close">✕</button>
                    {photos.length > 1 && <button className="lb-arrow lb-arrow--prev" onClick={lbPrev} aria-label="Previous">&#8249;</button>}
                    <div className="lb-img-wrap" onClick={e => e.stopPropagation()}>
                        <img src={photos[lightbox.index].imageUrl} alt={photos[lightbox.index].caption || 'Site photo'} className="lb-img" />
                        <div className="lb-caption">
                            <span className="lb-name">{photos[lightbox.index].caption || 'Site photo'}</span>
                            {photos.length > 1 && <span className="lb-counter">{lightbox.index + 1} / {photos.length}</span>}
                        </div>
                    </div>
                    {photos.length > 1 && <button className="lb-arrow lb-arrow--next" onClick={lbNext} aria-label="Next">&#8250;</button>}
                </div>,
                document.body
            )}
        </div>
    );
};

export default PhotosTab;
