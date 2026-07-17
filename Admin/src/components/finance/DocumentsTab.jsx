import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

/*
 * Generic file-on-record tab, shared by Client Detail (KYC/GSTIN/general
 * agreements — outlives any one job) and Project Detail (work orders,
 * site approvals, floor plans — specific to this job). Same backend shape
 * on both sides (financeClientDocument / financeProjectDocument), so this
 * only needs the API prefix and the scope field name to work either way.
 */
const DocumentsTab = ({ url, apiBase, scopeParam, scopeId, title = 'Documents', subtitle = 'Files on record — work orders, approvals, agreements, and anything else worth keeping.', emptyText = 'No documents on file yet.' }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);

    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchList = () => {
        setLoading(true);
        axios.get(`${url}/api/finance/${apiBase}/list`, { ...authHeader, params: { [scopeParam]: scopeId } })
            .then(res => { if (res.data.success) setDocuments(res.data.data); })
            .catch(() => toast.error('Error fetching documents'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchList(); }, [url, apiBase, scopeId]); // eslint-disable-line react-hooks/exhaustive-deps

    const openAdd = () => { setName(''); setNotes(''); setFile(null); setModalOpen(true); };
    const closeModal = () => setModalOpen(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!file) return toast.error('Choose a file first');
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append(scopeParam, scopeId);
            formData.append('name', name || file.name);
            formData.append('notes', notes);
            formData.append('file', file);
            const res = await axios.post(`${url}/api/finance/${apiBase}/add`, formData, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) {
                toast.success(res.data.message || 'Document uploaded');
                closeModal();
                fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error uploading document');
        } finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.post(`${url}/api/finance/${apiBase}/remove`, { _id: confirmItem._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing document'); }
        finally { setDeleting(false); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <h3 style={{ margin: '0 0 4px' }}>{title}</h3>
                    <p className="admin-subtitle" style={{ margin: 0 }}>{subtitle}</p>
                </div>
                <button type="button" className="add-btn" onClick={openAdd}>+ Upload Document</button>
            </div>

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Upload Document</h2>
                        <form onSubmit={submit}>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>File *</p>
                                    <input type="file" onChange={e => setFile(e.target.files[0])} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Name</p>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Defaults to file name" />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Notes</p>
                                    <input type="text" value={notes} onChange={e => setNotes(e.target.value)} />
                                </div>
                            </div>
                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Uploading…' : 'Upload Document'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : documents.length === 0 ? (
                <div className="admin-empty-state"><p>{emptyText}</p></div>
            ) : (
                <div className="list-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1.5fr 1fr 1.5fr 150px' }}>
                        <b>Name</b><b>Uploaded</b><b>Notes</b><b>Action</b>
                    </div>
                    {documents.map(d => (
                        <div key={d._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.5fr 1fr 1.5fr 150px' }}>
                            <p>{d.name}</p>
                            <p>{new Date(d.createdAt).toLocaleDateString()}</p>
                            <p>{d.notes || '—'}</p>
                            <div className="action-buttons" style={{ flexWrap: 'wrap', rowGap: '6px' }}>
                                <a href={d.fileUrl} target="_blank" rel="noreferrer" className="cursor edit-action" style={{ textDecoration: 'none' }}>View</a>
                                <p onClick={() => setConfirmItem(d)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove Document?</h3>
                        <p className="bin-confirm-name">"{confirmItem.name}"</p>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default DocumentsTab;
