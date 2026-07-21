import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
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
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording entry'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/cash-entries/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing entry'); }
    };

    const isManual = (e) => !e.relatedReceiptId && !e.relatedContractorPaymentId && !e.relatedVendorPaymentId;

    return (
        <div>
            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Amount (₹) *</p>
                        <input type="number" onWheel={e => e.target.blur()} min="0" value={form.amount} onChange={e => setField('amount', e.target.value)} />
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
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : `+ Add Cash ${isIn ? 'In' : 'Out'}`}</button>
                </div>
            </form>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1.5fr 1fr 100px' }}>
                    <b>Date</b><b>Amount</b><b>Reason</b><b>Source</b><b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : entries.length === 0 ? (
                    <div className="admin-empty-state"><p>No cash {isIn ? 'in' : 'out'} entries yet.</p></div>
                ) : (
                    entries.map(e => (
                        <div key={e._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1.5fr 1fr 100px' }}>
                            <p>{new Date(e.date).toLocaleDateString()}</p>
                            <p>₹{e.amount.toLocaleString('en-IN')}</p>
                            <p>{e.reason}</p>
                            <p>{isManual(e) ? <span className="item-category">Manual</span> : <span className="item-category">Auto</span>}</p>
                            <div className="action-buttons">
                                {isManual(e) && <p onClick={() => remove(e._id)} className="cursor delete-action">X</p>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default CashEntriesManager;
