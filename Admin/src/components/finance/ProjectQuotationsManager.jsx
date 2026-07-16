import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import '../../styles/list.css';

const QUOTATION_STATUS_LABEL = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', expired: 'Expired' };

/*
 * Quotations for one project — issued before the work order / signed rate
 * stage. This is the only place a quotation can be added or have its
 * status changed; ClientDetail.jsx's own Quotations tab is a read-only
 * rollup across a client's projects, fed by the same /client-quotations
 * endpoints filtered per project.
 */
const ProjectQuotationsManager = ({ url, projectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ date: '', amount: '', validUntil: '', notes: '' });
    const [saving, setSaving] = useState(false);

    const fetchList = () => {
        setLoading(true);
        axios.get(`${url}/api/finance/client-quotations/list`, { ...authHeader, params: { projectId } })
            .then(res => { if (res.data.success) setQuotations(res.data.data); })
            .catch(() => toast.error('Error fetching quotations'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchList(); }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.date) return toast.error('Date is required');
        if (form.amount === '') return toast.error('Amount is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/client-quotations/add`,
                { projectId, date: form.date, amount: form.amount, validUntil: form.validUntil || null, notes: form.notes }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Quotation added');
                setForm({ date: '', amount: '', validUntil: '', notes: '' });
                fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding quotation');
        } finally { setSaving(false); }
    };

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

    return (
        <div>
            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Date *</p>
                        <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Amount (₹) *</p>
                        <input type="number" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Valid Until</p>
                        <StyledDatePicker value={form.validUntil} onChange={v => setField('validUntil', v)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Notes</p>
                        <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Adding…' : '+ Add Quotation'}</button>
                </div>
            </form>

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : quotations.length === 0 ? (
                <div className="admin-empty-state"><p>No quotations issued for this project yet.</p></div>
            ) : (
                <div className="list-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '70px 1fr 1fr 1fr 110px 160px' }}>
                        <b>#</b><b>Date</b><b>Amount</b><b>Valid Until</b><b>Status</b><b>Action</b>
                    </div>
                    {quotations.map(q => (
                        <div key={q._id} className="list-table-format row-item" style={{ gridTemplateColumns: '70px 1fr 1fr 1fr 110px 160px' }}>
                            <p>#{q.quotationNumber}</p>
                            <p>{new Date(q.date).toLocaleDateString()}</p>
                            <p>₹{q.amount.toLocaleString('en-IN')}</p>
                            <p>{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}</p>
                            <p><span className="item-category">{QUOTATION_STATUS_LABEL[q.status]}</span></p>
                            <div className="action-buttons">
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
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProjectQuotationsManager;
