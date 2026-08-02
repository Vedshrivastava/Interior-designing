import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { date: '', amount: '', projectId: '', reason: '', notes: '' };

/*
 * Shared by Cash Book's Cash In and Cash Out tabs — same financeCashEntry
 * model, just filtered/fixed to one type. The manual add form here is only
 * for cash with no originating record (petty cash, owner draws); entries
 * auto-created by a receipt/contractor payment/vendor payment show up in
 * the list read-only (no remove action) — edit the originating record
 * instead, same pattern as Site Inventory's auto-generated consume rows.
 */
const CashEntriesManager = ({ url, type }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const isIn = type === 'in';

    const [projects, setProjects] = useState([]);
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
            const res = await axios.get(`${url}/api/finance/cash-entries/list`, authHeader);
            if (res.data.success) setEntries(res.data.data.filter(e => e.type === type));
        } catch { toast.error('Error fetching cash entries'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchEntries(); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps
    const fetchProjects = () => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    };
    useEffect(fetchProjects, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.reason.trim()) return toast.error('Reason is required');
        if (!form.date) return toast.error('Date is required');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/cash-entries/add`, { ...form, type }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording entry'); }
        finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/cash-entries/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing entry'); }
        finally { setDeleting(false); }
    };

    const isManual = (e) => !e.relatedReceiptId && !e.relatedContractorPaymentId && !e.relatedVendorPaymentId;

    return (
        <div>
            <div className="pq-section-header" style={{ marginBottom: '8px' }}>
                <h3 style={{ margin: 0 }}>Cash {isIn ? 'In' : 'Out'}</h3>
                <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>{`+ Add Cash ${isIn ? 'In' : 'Out'}`}</button>
            </div>
            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : entries.length === 0 ? (
                <div className="admin-empty-state"><p>No cash {isIn ? 'in' : 'out'} entries yet.</p></div>
            ) : (
                <div className="dash-chart-card cem-card">
                    <div className="cem-row cem-header">
                        <b className="cem-date">Date</b>
                        <b className="cem-amount">Amount</b>
                        <b className="cem-reason">Reason</b>
                        <b className="cem-source">Source</b>
                        <b className="cem-action">Action</b>
                    </div>
                    {entries.map(e => (
                        <div key={e._id} className="cem-row">
                            <p className="cem-date">{new Date(e.date).toLocaleDateString()}</p>
                            <p className="cem-amount"><span className="pq-group-label">Amount</span>₹{e.amount.toLocaleString('en-IN')}</p>
                            <p className="cem-reason"><span className="pq-group-label">Reason</span>{e.reason}</p>
                            <p className="cem-source"><span className="pq-group-label">Source</span>{isManual(e) ? <span className="item-category">Manual</span> : <span className="item-category">Auto</span>}</p>
                            <div className="cem-action">
                                {isManual(e) && (
                                    <button type="button" className="pq-btn-ghost-danger" onClick={() => setConfirmItem(e)} title="Remove entry" aria-label="Remove entry">
                                        <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay cem-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal cem-modal">
                        <div className="cem-modal-header">
                            <h2>{`Add Cash ${isIn ? 'In' : 'Out'}`}</h2>
                        </div>
                        <div className="cem-modal-body">
                            <form id="cem-form" onSubmit={submit}>
                                <div className="wizard-field-grid">
                                    <div className="add-product-name flex-col">
                                        <p>Amount (₹) *</p>
                                        <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Date *</p>
                                        <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Project</p>
                                        <select value={form.projectId} onChange={e => setField('projectId', e.target.value)}>
                                            <option value="">No project (general)</option>
                                            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="add-product-name flex-col wizard-field-full">
                                        <p>Reason *</p>
                                        <input type="text" placeholder={isIn ? 'e.g. petty cash return' : 'e.g. petty cash, owner draw'} value={form.reason} onChange={e => setField('reason', e.target.value)} />
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="edit-modal-actions cem-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button type="submit" form="cem-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this entry?</h3>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CashEntriesManager;
