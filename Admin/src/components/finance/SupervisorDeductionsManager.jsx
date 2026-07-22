import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';

const emptyForm = { amount: '', reason: '', date: '', projectId: '', workId: '', notes: '' };

/* Entry + list view for one supervisor's deductions — debit-side sibling
   of SupervisorIncentivesManager. Manual amount + reason, same as an
   incentive; typically entered when an engineer's periodic review of
   accumulated labour work finds the supervisor jointly accountable for a
   flaw (the labourer's own side of that same incident is a separate
   financeLabourDeduction, entered from that labourer's ledger). */
const SupervisorDeductionsManager = ({ url, employeeId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [works, setWorks] = useState([]);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/supervisor-deductions/list`, { ...authHeader, params: { employeeId } });
            if (res.data.success) setEntries(res.data.data);
        } catch { toast.error('Error fetching deductions'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (employeeId) fetchEntries(); }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps
    const fetchProjects = () => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    };
    useEffect(fetchProjects, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    // Work picker is scoped to whichever project is picked above — a
    // supervisor's deduction only makes sense pinned to a work within the
    // same project, not any work company-wide.
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
            const res = await axios.post(`${url}/api/finance/supervisor-deductions/add`, { ...form, employeeId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording deduction'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/supervisor-deductions/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing deduction'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0 }}>Deductions</h3>
                <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Deduction</button>
            </div>
            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : entries.length === 0 ? (
                <div className="admin-empty-state"><p>No deductions recorded yet.</p></div>
            ) : (
                <div className="list-table finance-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1.3fr 1fr 1fr 100px' }}>
                        <b>Date</b><b>Amount</b><b>Reason</b><b>Project</b><b>Work</b><b>Action</b>
                    </div>
                    {entries.map(e => (
                        <div key={e._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1.3fr 1fr 1fr 100px' }}>
                            <p>{new Date(e.date).toLocaleDateString()}</p>
                            <p>₹{e.amount.toLocaleString('en-IN')}</p>
                            <p>{e.reason}</p>
                            <p>{e.projectId?.name || '-'}</p>
                            <p>{e.workId?.workType || '-'}</p>
                            <div className="action-buttons"><p onClick={() => remove(e._id)} className="cursor delete-action">X</p></div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Add Deduction</h2>
                        <form onSubmit={submit}>
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
                                {form.projectId && works.length > 0 && (
                                    <div className="add-product-name flex-col">
                                        <p>Work (optional, e.g. a negligence deduction caught on one specific work)</p>
                                        <select value={form.workId} onChange={e => setField('workId', e.target.value)}>
                                            <option value="">Not tied to a specific work</option>
                                            {works.map(w => <option key={w._id} value={w._id}>{w.workType}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default SupervisorDeductionsManager;
