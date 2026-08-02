import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/dashboard.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', reason: '', date: '', projectId: '', workId: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', notes: '' };

/* Entry + list view for one supervisor's (financeEmployee) incentives —
   a discretionary payout distinct from their regular salary. No stored
   "approved area supervised" metric exists to compute this automatically. */
const SupervisorIncentivesManager = ({ url, employeeId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [works, setWorks] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/supervisor-incentives/list`, { ...authHeader, params: { employeeId } });
            if (res.data.success) setEntries(res.data.data);
        } catch { toast.error('Error fetching incentives'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (employeeId) fetchEntries(); }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps
    const fetchProjects = () => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader).then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
    };
    useEffect(fetchProjects, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    // Work picker is scoped to whichever project is picked above.
    const fetchWorksForProject = () => {
        if (!form.projectId) { setWorks([]); return; }
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId: form.projectId } })
            .then(res => { if (res.data.success) setWorks(res.data.data); }).catch(() => {});
    };
    useEffect(fetchWorksForProject, [url, form.projectId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeWorksChanged'], fetchWorksForProject);

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value, ...(key === 'projectId' ? { workId: '' } : {}) }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.reason.trim()) return toast.error('Reason is required');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/supervisor-incentives/add`, { ...form, employeeId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording incentive'); }
        finally { setSaving(false); }
    };

    const confirmRemove = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/supervisor-incentives/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing incentive'); }
        finally { setDeleting(false); }
    };

    return (
        <div>
            <div className="pq-section-header">
                <h3 style={{ margin: 0 }}>Incentives</h3>
                <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Incentive</button>
            </div>
            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : entries.length === 0 ? (
                <div className="admin-empty-state"><p>No incentives recorded yet.</p></div>
            ) : (
                <div className="dash-chart-card sin-card">
                    <div className="sin-row sin-header">
                        <b className="sin-date">Date</b>
                        <b className="sin-amount">Amount</b>
                        <b className="sin-reason">Reason</b>
                        <b className="sin-project">Project</b>
                        <b className="sin-work">Work</b>
                        <b className="sin-actions">Action</b>
                    </div>
                    {entries.map(e => (
                        <div key={e._id} className="sin-row">
                            <p className="sin-date"><span className="pq-group-label">Date</span>{new Date(e.date).toLocaleDateString()}</p>
                            <p className="sin-amount"><span className="pq-group-label">Amount</span>₹{e.amount.toLocaleString('en-IN')}</p>
                            <p className="sin-reason"><span className="pq-group-label">Reason</span>{e.reason}</p>
                            <p className="sin-project"><span className="pq-group-label">Project</span>{e.projectId?.name || '-'}</p>
                            <p className="sin-work"><span className="pq-group-label">Work</span>{e.workId?.workType || '-'}</p>
                            <div className="action-buttons sin-actions">
                                <button type="button" onClick={() => setConfirmItem(e)} className="pq-btn-ghost-danger" title="Remove incentive" aria-label="Remove incentive">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay sin-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal sin-modal">
                        <div className="sin-modal-header">
                            <h2>Add Incentive</h2>
                        </div>
                        <div className="sin-modal-body">
                        <form id="supervisor-incentive-form" onSubmit={submit}>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Amount (₹) *</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Reason *</p>
                                    <input type="text" value={form.reason} onChange={e => setField('reason', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Date *</p>
                                    <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Project (optional)</p>
                                    <select value={form.projectId} onChange={e => setField('projectId', e.target.value)}>
                                        <option value="">General</option>
                                        {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Payment Mode</p>
                                    <input type="text" value={form.paymentMode} onChange={e => setField('paymentMode', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Bank Account</p>
                                    <select value={form.bankAccountId} onChange={e => setField('bankAccountId', e.target.value)}>
                                        <option value="">Cash</option>
                                        {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.accountName} · {a.bankName}</option>)}
                                    </select>
                                </div>
                                {form.projectId && works.length > 0 && (
                                    <div className="add-product-name flex-col">
                                        <p>Work (optional, this is the closest thing to an "approved amount" a supervisor gets)</p>
                                        <select value={form.workId} onChange={e => setField('workId', e.target.value)}>
                                            <option value="">Not tied to a specific work</option>
                                            {works.map(w => <option key={w._id} value={w._id}>{w.workType}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </form>
                        </div>
                        <div className="edit-modal-actions sin-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button type="submit" form="supervisor-incentive-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this incentive?</h3>
                        <p className="bin-confirm-name">₹{confirmItem.amount.toLocaleString('en-IN')} — {confirmItem.reason}</p>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmRemove} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default SupervisorIncentivesManager;
