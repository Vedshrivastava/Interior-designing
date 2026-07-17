import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

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

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/supervisor-incentives/list`, { ...authHeader, params: { employeeId } });
            if (res.data.success) setEntries(res.data.data);
        } catch { toast.error('Error fetching incentives'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (employeeId) fetchEntries(); }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader).then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // Work picker is scoped to whichever project is picked above.
    useEffect(() => {
        if (!form.projectId) { setWorks([]); return; }
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId: form.projectId } })
            .then(res => { if (res.data.success) setWorks(res.data.data); }).catch(() => {});
    }, [url, form.projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value, ...(key === 'projectId' ? { workId: '' } : {}) }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.reason.trim()) return toast.error('Reason is required');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/supervisor-incentives/add`, { ...form, employeeId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording incentive'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/supervisor-incentives/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing incentive'); }
    };

    return (
        <div>
            <form onSubmit={submit} style={{ marginBottom: '20px' }}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Amount (₹) *</p>
                        <input type="number" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Reason *</p>
                        <input type="text" value={form.reason} onChange={e => setField('reason', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Date *</p>
                        <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Project (optional)</p>
                        <select value={form.projectId} onChange={e => setField('projectId', e.target.value)}>
                            <option value="">— General —</option>
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
                            <option value="">— Cash —</option>
                            {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.accountName} — {a.bankName}</option>)}
                        </select>
                    </div>
                    {form.projectId && works.length > 0 && (
                        <div className="add-product-name flex-col">
                            <p>Work (optional — this is the closest thing to an "approved amount" a supervisor gets)</p>
                            <select value={form.workId} onChange={e => setField('workId', e.target.value)}>
                                <option value="">— Not tied to a specific work —</option>
                                {works.map(w => <option key={w._id} value={w._id}>{w.workType}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : '+ Add Incentive'}</button>
                </div>
            </form>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1.3fr 1fr 1fr 100px' }}>
                    <b>Date</b><b>Amount</b><b>Reason</b><b>Project</b><b>Work</b><b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : entries.length === 0 ? (
                    <div className="admin-empty-state"><p>No incentives recorded yet.</p></div>
                ) : entries.map(e => (
                    <div key={e._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1.3fr 1fr 1fr 100px' }}>
                        <p>{new Date(e.date).toLocaleDateString()}</p>
                        <p>₹{e.amount.toLocaleString('en-IN')}</p>
                        <p>{e.reason}</p>
                        <p>{e.projectId?.name || '—'}</p>
                        <p>{e.workId?.workType || '—'}</p>
                        <div className="action-buttons"><p onClick={() => remove(e._id)} className="cursor delete-action">X</p></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SupervisorIncentivesManager;
