import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const ATTENDANCE_LABEL = { half_day: 'Half Day', full_day: 'Full Day', extra_day: 'Extra Day' };
const MULTIPLIER = { half_day: 0.5, full_day: 1, extra_day: 1.5 };

const emptyForm = { projectId: '', date: '', labourerName: '', attendanceType: 'full_day', rate: '', supervisorId: '', notes: '' };

/*
 * Casual/daily-wage labour — distinct from contractor teams. One component
 * covers all three places this shows up:
 *   - Daily Labour (top-level): no projectId/supervisorId passed — full
 *     entry form with its own project picker, list across every project.
 *   - Project detail > Daily Labour tab: projectId passed, fixed — the
 *     form's project field is hidden, list scoped to this project.
 *   - Supervisors > Daily Labour tab: supervisorId passed with
 *     readOnly — just this supervisor's recorded entries, no entry form
 *     (matches the build spec's framing: a supervisor's own record, not
 *     another entry point).
 *
 * No payment fields on the entry form — payment happens once, in bulk, at
 * settlement time (see SupervisorLabourPaymentsManager), not per entry.
 * Each entry just shows whether it's been swept into a settlement yet.
 */
const DailyLabourManager = ({ url, projectId, supervisorId, readOnly = false }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ ...emptyForm, projectId: projectId || '' });
    const [saving, setSaving] = useState(false);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const params = {};
            if (projectId) params.projectId = projectId;
            if (supervisorId) params.supervisorId = supervisorId;
            const res = await axios.get(`${url}/api/finance/daily-labour/list`, { ...authHeader, params });
            if (res.data.success) setEntries(res.data.data);
        } catch { toast.error('Error fetching daily labour'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchEntries(); }, [projectId, supervisorId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (readOnly) return;
        if (!projectId) axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/employees/list`, authHeader).then(res => { if (res.data.success) setEmployees(res.data.data); }).catch(() => {});
    }, [url, projectId, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const amountPreview = (Number(form.rate) || 0) * (MULTIPLIER[form.attendanceType] || 0);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.projectId) return toast.error('Project is required');
        if (!form.date) return toast.error('Date is required');
        if (!form.labourerName.trim()) return toast.error('Labourer name is required');
        if (!form.rate || Number(form.rate) <= 0) return toast.error('Rate must be greater than zero');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/daily-labour/add`, form, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm({ ...emptyForm, projectId: projectId || '' }); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording daily labour'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/daily-labour/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing entry'); }
    };

    const gridColumns = projectId ? '1fr 1.2fr 1fr 1fr 1fr 1fr 100px 100px' : '1fr 1.2fr 1.2fr 1fr 1fr 1fr 1fr 100px 100px';

    return (
        <div>
            {!readOnly && (
                <form onSubmit={submit} style={{ marginBottom: '24px' }}>
                    <div className="wizard-field-grid">
                        {!projectId && (
                            <div className="add-product-name flex-col">
                                <p>Project *</p>
                                <select value={form.projectId} onChange={e => setField('projectId', e.target.value)}>
                                    <option value="">Select project…</option>
                                    {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="add-product-name flex-col">
                            <p>Date *</p>
                            <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
                        </div>
                        <div className="add-product-name flex-col">
                            <p>Labourer Name *</p>
                            <input type="text" value={form.labourerName} onChange={e => setField('labourerName', e.target.value)} />
                        </div>
                        <div className="add-product-name flex-col">
                            <p>Attendance Type *</p>
                            <select value={form.attendanceType} onChange={e => setField('attendanceType', e.target.value)}>
                                <option value="half_day">Half Day (0.5×)</option>
                                <option value="full_day">Full Day (1×)</option>
                                <option value="extra_day">Extra Day (1.5×)</option>
                            </select>
                        </div>
                        <div className="add-product-name flex-col">
                            <p>Rate (₹/day) *</p>
                            <input type="number" value={form.rate} onChange={e => setField('rate', e.target.value)} />
                        </div>
                        <div className="add-product-name flex-col">
                            <p>Amount (auto)</p>
                            <input type="text" value={`₹${amountPreview.toLocaleString('en-IN')}`} disabled />
                        </div>
                        <div className="add-product-name flex-col">
                            <p>Recorded By (Supervisor)</p>
                            <select value={form.supervisorId} onChange={e => setField('supervisorId', e.target.value)}>
                                <option value="">— None —</option>
                                {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                            </select>
                        </div>
                        <div className="add-product-name flex-col wizard-field-full">
                            <p>Notes</p>
                            <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                        </div>
                    </div>
                    <div className="wizard-actions" style={{ marginTop: '16px' }}>
                        <span />
                        <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : '+ Add Daily Labour'}</button>
                    </div>
                </form>
            )}

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: gridColumns }}>
                    <b>Date</b>
                    {!projectId && <b>Project</b>}
                    <b>Labourer</b><b>Type</b><b>Rate</b><b>Amount</b><b>Supervisor</b><b>Status</b>
                    {!readOnly && <b>Action</b>}
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : entries.length === 0 ? (
                    <div className="admin-empty-state"><p>No daily labour entries yet.</p></div>
                ) : entries.map(e => (
                    <div key={e._id} className="list-table-format row-item" style={{ gridTemplateColumns: gridColumns }}>
                        <p>{new Date(e.date).toLocaleDateString()}</p>
                        {!projectId && <p>{e.projectId?.name || '—'}</p>}
                        <p>{e.labourerName}</p>
                        <p>{ATTENDANCE_LABEL[e.attendanceType]}</p>
                        <p>₹{e.rate.toLocaleString('en-IN')}</p>
                        <p>₹{e.amount.toLocaleString('en-IN')}</p>
                        <p>{e.supervisorId?.name || '—'}</p>
                        <p style={{ color: e.settledInPaymentId ? 'var(--moss)' : '#c0392b' }}>{e.settledInPaymentId ? 'Settled' : 'Unsettled'}</p>
                        {!readOnly && <div className="action-buttons"><p onClick={() => remove(e._id)} className="cursor delete-action">X</p></div>}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DailyLabourManager;
