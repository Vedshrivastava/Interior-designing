import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import ViewAttachmentLink from './ViewAttachmentLink';
import '../../styles/list.css';
import '../../styles/dashboard.css';

// resourceKey -> { apiBase, idField } — the three entity types that carry
// a documents:[{url,note}] field (Labourer, Vendor/Contractor, Employee/
// Supervisor), each with its own list/add-document/remove-document routes
// but an identical shape, so one view covers all three People pages.
const RESOURCE_CONFIG = {
    labourers: { apiBase: '/api/finance/labourers', idField: 'labourerId' },
    vendors:   { apiBase: '/api/finance/vendors',    idField: 'vendorId' },
    employees: { apiBase: '/api/finance/employees',  idField: 'employeeId' },
};

/*
 * Documents on file for one person (labourer, contractor, or
 * supervisor/employee — all three models carry the same documents:
 * [{url, note}] shape). Reused across ContractorsPage, the new Labourers
 * page, and EmployeesPage's Documents tab — only `resourceKey` and
 * `entityId` change per caller. Fetches the whole list and finds this
 * one record client-side (same pattern as the rest of this codebase;
 * there's no GET-by-id endpoint for these resources and rosters are
 * small enough that this is cheap).
 */
const PersonDocumentsView = ({ url, resourceKey, entityId, entityLabel = 'person' }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const { apiBase, idField } = RESOURCE_CONFIG[resourceKey];

    const [person, setPerson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [file, setFile] = useState(null);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [confirmDoc, setConfirmDoc] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchPerson = () => {
        setLoading(true);
        axios.get(`${url}${apiBase}/list`, authHeader)
            .then(res => { if (res.data.success) setPerson(res.data.data.find(p => p._id === entityId) || null); })
            .catch(() => toast.error('Error fetching documents'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { if (entityId) fetchPerson(); else setLoading(false); }, [url, entityId]); // eslint-disable-line react-hooks/exhaustive-deps

    const addDocument = async () => {
        if (!file) return toast.error('Choose a file first');
        setSaving(true);
        try {
            const data = new FormData();
            data.append(idField, entityId);
            data.append('note', note);
            data.append('document', file);
            const res = await axios.post(`${url}${apiBase}/documents/add`, data, {
                headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) {
                toast.success('Document added');
                setFile(null); setNote('');
                fetchPerson();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding document');
        } finally { setSaving(false); }
    };

    const confirmRemoveDocument = async () => {
        if (!confirmDoc) return;
        setDeleting(true);
        try {
            const res = await axios.post(`${url}${apiBase}/documents/remove`, { [idField]: entityId, documentId: confirmDoc._id }, authHeader);
            if (res.data.success) { toast.success('Document removed'); setConfirmDoc(null); fetchPerson(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing document'); }
        finally { setDeleting(false); }
    };

    if (!entityId) return <div className="admin-empty-state"><p>Select a {entityLabel} to view their documents.</p></div>;
    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!person) return <div className="admin-empty-state"><p>Not found.</p></div>;

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>Documents on file for {person.name}.</p>

            {person.documents.length === 0 ? (
                <div className="admin-empty-state" style={{ marginBottom: '20px' }}><p>No documents on file yet.</p></div>
            ) : (
                <div className="dash-chart-card pdv-card" style={{ marginBottom: '20px' }}>
                    {person.documents.map(d => (
                        <div key={d._id} className="pdv-row">
                            <ViewAttachmentLink url={d.url} name={d.note} className="item-name pdv-name" style={{ textDecoration: 'none' }}>
                                📄 {d.note || 'Untitled document'}
                            </ViewAttachmentLink>
                            <div className="action-buttons pdv-actions">
                                <button type="button" onClick={() => setConfirmDoc(d)} className="pq-btn-ghost-danger" title="Remove document" aria-label="Remove document">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="contractor-assign-box">
                <div className="contractor-assign-row">
                    <div className="contractor-assign-picker">
                        <input type="file" onChange={e => setFile(e.target.files[0] || null)} />
                    </div>
                    <div className="contractor-assign-notes">
                        <input type="text" placeholder="What is this document? (e.g. Aadhar Card)" value={note} onChange={e => setNote(e.target.value)} />
                    </div>
                </div>
                <div className="contractor-assign-footer">
                    <button type="button" className="add-point-btn" disabled={saving} onClick={addDocument}>
                        {saving ? 'Adding…' : '+ Add Document'}
                    </button>
                </div>
            </div>

            {confirmDoc && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmDoc(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this document?</h3>
                        <p className="bin-confirm-name">{confirmDoc.note || 'Untitled document'}</p>
                        <p className="bin-confirm-warning">This can't be undone.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmDoc(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmRemoveDocument} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default PersonDocumentsView;
