import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const CATEGORY_OPTIONS = [
    { value: 'contractor', label: 'Contractor' },
    { value: 'labour', label: 'Labour' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'other', label: 'Other' },
];
const REVIEW_FILTER_OPTIONS = [
    { value: 'pending', label: 'Pending Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
];
const REVIEW_TONE = { pending: '#b8860b', approved: 'var(--moss)', rejected: '#c0392b' };
const REVIEW_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
const todayKey = () => new Date().toISOString().slice(0, 10);
const emptyForm = { projectId: '', date: todayKey(), workDescription: '', partyName: '', partyType: 'other', amountPaid: '', amountChargedToClient: '', notes: '' };

/*
 * Hand-written daily records for projects with too many small, unrated
 * tasks to formalize as individual Works (a plumbing project with
 * hundreds of jobs, say) — one entry a day covers what was done, who got
 * paid how much, and what to charge the client for it. Dual-mode, same
 * pattern as SiteDiaryManager: `projectId` fixed → scoped to one project;
 * omitted → cross-project (this page, Site Operations' own "Manual
 * Entries" tab), with a Project picker and column added.
 *
 * Every entry needs Approval before it counts toward Payables/Revenue/
 * Profit — mirrors the sqft-based Work Review Panel's gate, just per-row
 * instead of a running ceiling against one Work (see
 * financeManualEntry.js's model comment). Editing an approved/rejected
 * entry's amounts silently reverts it to Pending server-side — this UI
 * just reflects whatever reviewStatus comes back after a save.
 */
const ManualEntriesManager = ({ url, projectId: fixedProjectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const crossProject = !fixedProjectId;

    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(crossProject);
    const [selectedProject, setSelectedProject] = useState('');
    const [reviewFilter, setReviewFilter] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    const fetchProjects = () => {
        if (!crossProject) return;
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {}).finally(() => setProjectsLoading(false));
    };
    useEffect(fetchProjects, [url, crossProject]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (fixedProjectId) params.projectId = fixedProjectId;
            else if (selectedProject) params.projectId = selectedProject;
            const res = await axios.get(`${url}/api/finance/manual-entries/list`, { ...authHeader, params });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error('Error fetching manual entries'); }
        finally { setLoading(false); }
    }, [url, fixedProjectId, selectedProject]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchItems(); }, [fetchItems]);
    useFinanceWsRefresh(['financeManualEntriesChanged'], fetchItems);

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const openAdd = () => { setForm({ ...emptyForm, projectId: fixedProjectId || selectedProject || '' }); setModalOpen(true); };
    const closeModal = () => setModalOpen(false);

    const submit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const projectId = fixedProjectId || form.projectId;
        if (!projectId) return toast.error('Project is required');
        if (!form.date) return toast.error('Date is required');
        if (!form.workDescription.trim()) return toast.error('What was done is required');
        if ((!form.amountPaid || Number(form.amountPaid) <= 0) && (!form.amountChargedToClient || Number(form.amountChargedToClient) <= 0)) {
            return toast.error('Enter an amount paid, charged to client, or both');
        }
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/manual-entries/add`, { ...form, projectId }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                closeModal();
                await fetchItems();
            } else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error logging entry'); }
        finally { setSaving(false); }
    };

    const approve = async (item) => {
        setBusyId(item._id);
        try {
            const res = await axios.post(`${url}/api/finance/manual-entries/approve`, { _id: item._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchItems(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error approving entry'); }
        finally { setBusyId(null); }
    };

    const submitReject = async () => {
        if (!rejectTarget) return;
        setBusyId(rejectTarget._id);
        try {
            const res = await axios.post(`${url}/api/finance/manual-entries/reject`, { _id: rejectTarget._id, rejectionReason: rejectReason }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setRejectTarget(null); setRejectReason(''); await fetchItems(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error rejecting entry'); }
        finally { setBusyId(null); }
    };

    const markPaid = async (item) => {
        setBusyId(item._id);
        try {
            const res = await axios.post(`${url}/api/finance/manual-entries/mark-paid`, { _id: item._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchItems(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error marking paid'); }
        finally { setBusyId(null); }
    };

    const remove = async (item) => {
        try {
            const res = await axios.delete(`${url}/api/finance/manual-entries/remove`, { ...authHeader, data: { _id: item._id } });
            if (res.data.success) { toast.success(res.data.message); await fetchItems(); }
            else toast.error(res.data.message || 'Error removing entry');
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing entry'); }
    };

    const visibleItems = reviewFilter ? items.filter(i => i.reviewStatus === reviewFilter) : items;

    return (
        <div>
            <div className="dwp-filter-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {crossProject && (
                        <div className="add-product-name flex-col" style={{ minWidth: '220px' }}>
                            <p>Project</p>
                            <StyledSelect value={selectedProject} onChange={setSelectedProject} placeholder="All Projects" loading={projectsLoading}
                                options={projects.map(p => ({ value: p._id, label: p.name }))} />
                        </div>
                    )}
                    <div className="add-product-name flex-col" style={{ minWidth: '180px' }}>
                        <p>Review Status</p>
                        <StyledSelect value={reviewFilter} onChange={setReviewFilter} placeholder="All Entries" options={REVIEW_FILTER_OPTIONS} />
                    </div>
                </div>
                <button type="button" className="add-btn" onClick={openAdd}>+ Log Entry</button>
            </div>

            <p className="admin-subtitle" style={{ margin: '0 0 20px' }}>
                For work too fragmented into small tasks to be worth a formal Work with its own rate. Log what was done, who got paid, and what to charge the client — nothing counts toward Payables/Revenue/Profit until it's Approved below.
            </p>

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay me-overlay" style={{ zIndex: 100000 }}>
                    <div className="loader-modal-box edit-modal me-modal">
                        <div className="me-modal-header">
                            <h2>Log Manual Entry</h2>
                        </div>

                        <div className="me-modal-body">
                            <form id="manual-entry-form" onSubmit={submit}>
                                <div className="wizard-field-grid">
                                    {crossProject && (
                                        <div className="add-product-name flex-col">
                                            <p>Project *</p>
                                            <StyledSelect value={form.projectId} onChange={v => setField('projectId', v)} placeholder="Select project…" loading={projectsLoading}
                                                options={projects.map(p => ({ value: p._id, label: p.name }))} />
                                        </div>
                                    )}
                                    <div className="add-product-name flex-col">
                                        <p>Date *</p>
                                        <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                                    </div>
                                    <div className="add-product-name flex-col wizard-field-full">
                                        <p>What Was Done *</p>
                                        <input type="text" value={form.workDescription} onChange={e => setField('workDescription', e.target.value)} placeholder="e.g. CPVC fitting, kitchen + 2 bathrooms" />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Who</p>
                                        <input type="text" value={form.partyName} onChange={e => setField('partyName', e.target.value)} placeholder="Contractor / labourer name" />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Category</p>
                                        <StyledSelect value={form.partyType} onChange={v => setField('partyType', v || 'other')} options={CATEGORY_OPTIONS} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Amount Paid</p>
                                        <input type="number" min="0" step="0.01" value={form.amountPaid} onChange={e => setField('amountPaid', e.target.value)} placeholder="0.00" />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Charge to Client</p>
                                        <input type="number" min="0" step="0.01" value={form.amountChargedToClient} onChange={e => setField('amountChargedToClient', e.target.value)} placeholder="0.00" />
                                    </div>
                                    <div className="add-product-name flex-col wizard-field-full">
                                        <p>Notes (optional)</p>
                                        <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="edit-modal-actions me-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                            <button type="submit" form="manual-entry-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : <><FontAwesomeIcon icon={faCheck} className="pq-action-icon" /> Log Entry</>}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {rejectTarget && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !busyId && setRejectTarget(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Reject Entry?</h3>
                        <p className="bin-confirm-name">{rejectTarget.workDescription}</p>
                        <div className="add-product-name flex-col" style={{ margin: '12px 0', textAlign: 'left' }}>
                            <p>Reason (optional)</p>
                            <input type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Why this doesn't count" />
                        </div>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => { setRejectTarget(null); setRejectReason(''); }} disabled={!!busyId}>Cancel</button>
                            <button className="bin-btn-delete" onClick={submitReject} disabled={!!busyId}>{busyId === rejectTarget._id ? 'Rejecting…' : 'Reject'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : visibleItems.length === 0 ? (
                <div className="admin-empty-state"><p>No manual entries yet.</p></div>
            ) : (
                <div className="dash-chart-card camp-line-table-card">
                    <table className="camp-line-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                {crossProject && <th>Project</th>}
                                <th>What Was Done</th><th>Who</th><th>Paid</th><th>Charged</th><th>Review</th><th>Payment</th><th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleItems.map(item => (
                                <tr key={item._id}>
                                    <td data-label="Date">{new Date(item.date).toLocaleDateString('en-IN')}</td>
                                    {crossProject && <td data-label="Project">{item.projectId?.name || '—'}</td>}
                                    <td data-label="What Was Done">{item.workDescription}{item.notes && <span className="pq-group-label" style={{ display: 'block', fontStyle: 'italic', opacity: 0.7 }}>{item.notes}</span>}</td>
                                    <td data-label="Who">{item.partyName || '—'}{item.partyName && <span className="item-category" style={{ marginLeft: '6px' }}>{CATEGORY_OPTIONS.find(c => c.value === item.partyType)?.label}</span>}</td>
                                    <td data-label="Paid">{item.amountPaid > 0 ? `₹${item.amountPaid.toLocaleString('en-IN')}` : '—'}</td>
                                    <td data-label="Charged">{item.amountChargedToClient > 0 ? `₹${item.amountChargedToClient.toLocaleString('en-IN')}` : '—'}</td>
                                    <td data-label="Review">
                                        <span className="item-category" style={{ color: REVIEW_TONE[item.reviewStatus] }}>{REVIEW_LABEL[item.reviewStatus]}</span>
                                        {item.reviewStatus === 'rejected' && item.rejectionReason && <span className="pq-group-label" style={{ display: 'block' }}>{item.rejectionReason}</span>}
                                    </td>
                                    <td data-label="Payment">
                                        {item.amountPaid > 0 ? (
                                            <span className="item-category" style={{ color: item.paymentStatus === 'paid' ? 'var(--moss)' : '#b8860b' }}>
                                                {item.paymentStatus === 'paid' ? 'Paid' : 'Outstanding'}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td data-label="Action">
                                        <div className="action-buttons" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                            {item.reviewStatus === 'pending' && (
                                                <>
                                                    <p onClick={() => busyId !== item._id && approve(item)} className="cursor edit-action">{busyId === item._id ? 'Approving…' : 'Approve'}</p>
                                                    <p onClick={() => setRejectTarget(item)} className="cursor delete-action" style={{ borderColor: 'rgba(192,57,43,0.3)' }}>Reject</p>
                                                </>
                                            )}
                                            {item.reviewStatus === 'approved' && item.amountPaid > 0 && item.paymentStatus === 'outstanding' && (
                                                <p onClick={() => busyId !== item._id && markPaid(item)} className="cursor edit-action">{busyId === item._id ? 'Marking…' : 'Mark Paid'}</p>
                                            )}
                                            <p onClick={() => remove(item)} className="cursor delete-action">X</p>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ManualEntriesManager;
