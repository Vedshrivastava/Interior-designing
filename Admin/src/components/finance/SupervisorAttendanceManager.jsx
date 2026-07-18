import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const STATUS_LABEL = { present: 'Present', absent: 'Absent', half_day: 'Half Day', leave: 'Leave' };
const emptyForm = { date: '', status: 'present', notes: '' };

/* Entry + list view for one supervisor's (financeEmployee) attendance —
   no calendar widget in this codebase yet, so a plain date-sorted list
   serves as the "calendar view" the spec asks for. */
const SupervisorAttendanceManager = ({ url, employeeId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/supervisor-attendance/list`, { ...authHeader, params: { employeeId } });
            if (res.data.success) setEntries(res.data.data);
        } catch { toast.error('Error fetching attendance'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (employeeId) fetchEntries(); }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/supervisor-attendance/add`, { ...form, employeeId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording attendance'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/supervisor-attendance/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing attendance entry'); }
    };

    return (
        <div>
            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Date *</p>
                        <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Status *</p>
                        <select value={form.status} onChange={e => setField('status', e.target.value)}>
                            {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Notes (optional)</p>
                        <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : '+ Mark Attendance'}</button>
                </div>
            </form>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1.5fr 100px' }}>
                    <b>Date</b><b>Status</b><b>Notes</b><b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : entries.length === 0 ? (
                    <div className="admin-empty-state"><p>No attendance recorded yet.</p></div>
                ) : entries.map(e => (
                    <div key={e._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1.5fr 100px' }}>
                        <p>{new Date(e.date).toLocaleDateString()}</p>
                        <p><span className="item-category">{STATUS_LABEL[e.status]}</span></p>
                        <p>{e.notes || '-'}</p>
                        <div className="action-buttons"><p onClick={() => remove(e._id)} className="cursor delete-action">X</p></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SupervisorAttendanceManager;
