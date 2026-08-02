import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import StyledDatePicker from './StyledDatePicker';
import '../../styles/list.css';
import '../../styles/dashboard.css';
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
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

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
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording attendance'); }
        finally { setSaving(false); }
    };

    const confirmRemove = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/supervisor-attendance/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing attendance entry'); }
        finally { setDeleting(false); }
    };

    return (
        <div>
            <div className="pq-section-header">
                <h3 style={{ margin: 0 }}>Attendance</h3>
                <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Mark Attendance</button>
            </div>
            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : entries.length === 0 ? (
                <div className="admin-empty-state"><p>No attendance recorded yet.</p></div>
            ) : (
                <div className="dash-chart-card saa-card">
                    <div className="saa-row saa-header">
                        <b className="saa-date">Date</b>
                        <b className="saa-status">Status</b>
                        <b className="saa-notes">Notes</b>
                        <b className="saa-actions">Action</b>
                    </div>
                    {entries.map(e => (
                        <div key={e._id} className="saa-row">
                            <p className="saa-date">{new Date(e.date).toLocaleDateString()}</p>
                            <p className="saa-status"><span className="item-category">{STATUS_LABEL[e.status]}</span></p>
                            <p className="saa-notes"><span className="pq-group-label">Notes</span>{e.notes || '-'}</p>
                            <div className="action-buttons saa-actions">
                                <button type="button" onClick={() => setConfirmItem(e)} className="pq-btn-ghost-danger" title="Remove entry" aria-label="Remove entry">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay saa-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal saa-modal">
                        <div className="saa-modal-header">
                            <h2>Mark Attendance</h2>
                        </div>
                        <div className="saa-modal-body">
                        <form id="supervisor-attendance-form" onSubmit={submit}>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Date *</p>
                                    <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
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
                        </form>
                        </div>
                        <div className="edit-modal-actions saa-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button type="submit" form="supervisor-attendance-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this attendance entry?</h3>
                        <p className="bin-confirm-name">{new Date(confirmItem.date).toLocaleDateString()} — {STATUS_LABEL[confirmItem.status]}</p>
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

export default SupervisorAttendanceManager;
