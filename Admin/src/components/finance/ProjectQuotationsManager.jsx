import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import AddQuotationModal from './AddQuotationModal';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const QUOTATION_STATUS_LABEL = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' };

/*
 * Quotations for one project — issued before the work order / signed rate
 * stage. This is the only place a quotation can be added or have its
 * status changed; ClientDetail.jsx's own Quotations tab is a read-only
 * rollup across a client's projects, fed by the same /client-quotations
 * endpoints filtered per project.
 *
 * Each quotation's original file uploads through financeProjectDocument
 * (tagged with quotationId) rather than being stored on the quotation
 * itself — same file, same record, so it also shows up untouched on this
 * project's own Documents tab with no extra plumbing there. A file can be
 * attached right at creation (AddQuotationModal) or after the fact via the
 * row's Upload/Replace action — both funnel through the same endpoint.
 *
 * The row's File actions (View/Upload) and Status actions (Accept/Reject)
 * are two independent button groups, so they get their own column widths
 * plus a divider between them — at the old 130px/160px widths the pill
 * buttons overflowed their column and visually ran into each other
 * ("ReplaceAccept").
 */
const ProjectQuotationsManager = ({ url, projectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [uploadingId, setUploadingId] = useState(null);
    const fileInputRef = useRef(null);
    const uploadTargetRef = useRef(null);

    const fetchList = () => {
        setLoading(true);
        axios.get(`${url}/api/finance/client-quotations/list`, { ...authHeader, params: { projectId } })
            .then(res => { if (res.data.success) setQuotations(res.data.data); })
            .catch(() => toast.error('Error fetching quotations'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchList(); }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const changeStatus = async (_id, status) => {
        try {
            const res = await axios.post(`${url}/api/finance/client-quotations/status`, { _id, status }, authHeader);
            if (res.data.success) { toast.success(res.data.message); fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error updating status'); }
    };

    const remove = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/client-quotations/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing quotation'); }
    };

    // One shared hidden file input, retargeted per row via uploadTargetRef —
    // simpler than an input per quotation, and there's never more than one
    // upload in flight from this tab at a time.
    const triggerUpload = (q) => { uploadTargetRef.current = q; fileInputRef.current?.click(); };

    const handleFileChosen = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        const quotation = uploadTargetRef.current;
        if (!file || !quotation) return;
        setUploadingId(quotation._id);
        try {
            const formData = new FormData();
            formData.append('projectId', projectId);
            formData.append('quotationId', quotation._id);
            formData.append('name', `Quotation #${quotation.quotationNumber}`);
            formData.append('file', file);
            const res = await axios.post(`${url}/api/finance/project-documents/add`, formData, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) { toast.success('Quotation file uploaded'); fetchList(); }
            else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error uploading file');
        } finally { setUploadingId(null); }
    };

    return (
        <div>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChosen} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <h3 style={{ margin: '0 0 4px' }}>Quotations</h3>
                    <p className="admin-subtitle" style={{ margin: 0 }}>Issued to the client before the work order / signed rate stage; accept one to move the project forward.</p>
                </div>
                <button type="button" className="add-btn" onClick={() => setAddModalOpen(true)}>+ Add Quotation</button>
            </div>

            {addModalOpen && (
                <AddQuotationModal
                    url={url} projectId={projectId}
                    onClose={() => setAddModalOpen(false)}
                    onSaved={fetchList}
                />
            )}

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : quotations.length === 0 ? (
                <div className="admin-empty-state"><p>No quotations issued for this project yet.</p></div>
            ) : (
                /* Own row class, not .list-table-format — that class's mobile
                   transform is hard-coded for a different row shape (image +
                   title + subtitle + action buttons) and mangled this
                   table's columns the same way it mangled every other one on
                   this app before its own pass. Every cell carries an
                   explicit grid-area (num/date/amount/status/file/
                   statusActions) so mobile can regroup them via
                   grid-template-areas alone: number paired with its status
                   badge, date+amount below, then each action group gets its
                   own full-width, clearly labeled row instead of two
                   dashed-divider groups crammed side by side. */
                <div className="dash-chart-card pq-card">
                    <div className="pq-row pq-header">
                        <b className="pq-num">#</b><b className="pq-date">Date</b><b className="pq-amount">Amount</b><b className="pq-status">Status</b><b className="pq-file">File</b><b className="pq-status-actions">Status Action</b>
                    </div>
                    {quotations.map(q => (
                        <div key={q._id} className="pq-row">
                            <p className="pq-num">#{q.quotationNumber}</p>
                            <p className="pq-date">{new Date(q.date).toLocaleDateString()}</p>
                            <p className="pq-amount">₹{q.amount.toLocaleString('en-IN')}</p>
                            <p className="pq-status"><span className="item-category">{QUOTATION_STATUS_LABEL[q.status]}</span></p>
                            <div className="pq-file">
                                <span className="pq-group-label">File</span>
                                <div className="action-buttons pq-action-buttons">
                                    {q.documents?.[0] && (
                                        <a href={q.documents[0].fileUrl} target="_blank" rel="noreferrer" className="cursor edit-action" style={{ textDecoration: 'none' }}>View</a>
                                    )}
                                    <p onClick={() => triggerUpload(q)} className="cursor edit-action">
                                        {uploadingId === q._id ? 'Uploading…' : q.documents?.[0] ? 'Replace' : 'Upload'}
                                    </p>
                                </div>
                            </div>
                            <div className="pq-status-actions">
                                <span className="pq-group-label">Status</span>
                                <div className="action-buttons pq-action-buttons">
                                    {q.status === 'pending' ? (
                                        <>
                                            <p onClick={() => changeStatus(q._id, 'accepted')} className="cursor edit-action">Accept</p>
                                            <p onClick={() => changeStatus(q._id, 'rejected')} className="cursor delete-action">Reject</p>
                                        </>
                                    ) : (
                                        <p onClick={() => changeStatus(q._id, 'pending')} className="cursor edit-action">Reopen</p>
                                    )}
                                    <p onClick={() => remove(q._id)} className="cursor delete-action">X</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProjectQuotationsManager;
