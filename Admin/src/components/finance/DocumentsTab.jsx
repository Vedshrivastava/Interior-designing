import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

/*
 * Generic file-on-record tab, shared by Client Detail (KYC/GSTIN/general
 * agreements — outlives any one job) and Project Detail (work orders,
 * site approvals, floor plans — specific to this job). Same backend shape
 * on both sides (financeClientDocument / financeProjectDocument), so this
 * only needs the API prefix and the scope field name to work either way.
 */
const DocumentsTab = ({ url, apiBase, scopeParam, scopeId, emptyText = 'No documents on file yet.' }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const fileInputId = `${apiBase}-doc-file-input`;

    const fetchList = () => {
        setLoading(true);
        axios.get(`${url}/api/finance/${apiBase}/list`, { ...authHeader, params: { [scopeParam]: scopeId } })
            .then(res => { if (res.data.success) setDocuments(res.data.data); })
            .catch(() => toast.error('Error fetching documents'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchList(); }, [url, apiBase, scopeId]); // eslint-disable-line react-hooks/exhaustive-deps

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
                setName(''); setNotes(''); setFile(null);
                const input = document.getElementById(fileInputId);
                if (input) input.value = '';
                fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error uploading document');
        } finally { setSaving(false); }
    };

    const remove = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/${apiBase}/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing document'); }
    };

    return (
        <div>
            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>File *</p>
                        <input id={fileInputId} type="file" onChange={e => setFile(e.target.files[0])} />
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
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Uploading…' : '+ Upload Document'}</button>
                </div>
            </form>

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : documents.length === 0 ? (
                <div className="admin-empty-state"><p>{emptyText}</p></div>
            ) : (
                <div className="list-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1.5fr 1fr 1.5fr 140px' }}>
                        <b>Name</b><b>Uploaded</b><b>Notes</b><b>Action</b>
                    </div>
                    {documents.map(d => (
                        <div key={d._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.5fr 1fr 1.5fr 140px' }}>
                            <p>{d.name}</p>
                            <p>{new Date(d.createdAt).toLocaleDateString()}</p>
                            <p>{d.notes || '—'}</p>
                            <div className="action-buttons">
                                <a href={d.fileUrl} target="_blank" rel="noreferrer" className="cursor edit-action" style={{ textDecoration: 'none' }}>View</a>
                                <p onClick={() => remove(d._id)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DocumentsTab;
