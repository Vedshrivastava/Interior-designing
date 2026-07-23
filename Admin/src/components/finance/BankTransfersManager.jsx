import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { fromAccountId: '', toAccountId: '', amount: '', date: '', notes: '' };

const BankTransfersManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [accounts, setAccounts] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/bank-transfers/list`, authHeader);
            if (res.data.success) setTransfers(res.data.data);
        } catch { toast.error('Error fetching transfers'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTransfers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const fetchAccounts = () => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader).then(res => { if (res.data.success) setAccounts(res.data.data); }).catch(() => {});
    };
    useEffect(fetchAccounts, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    // financeBankTransfer.js's own add/remove only ever broadcasts this one
    // event (no separate "transfers changed" type) — same event
    // BankBalanceView/BankStatementView listen for.
    useFinanceWsRefresh(['financeBankAccountsChanged'], () => { fetchTransfers(); fetchAccounts(); });

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.fromAccountId || !form.toAccountId) return toast.error('From and To accounts are required');
        if (form.fromAccountId === form.toAccountId) return toast.error('From and To accounts must be different');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/bank-transfers/add`, form, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchTransfers(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording transfer'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/bank-transfers/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchTransfers(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing transfer'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0 }}>Transfers</h3>
                <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Transfer</button>
            </div>
            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : transfers.length === 0 ? (
                <div className="admin-empty-state"><p>No transfers yet.</p></div>
            ) : (
                <div className="list-table finance-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr 1fr 100px' }}>
                        <b>Date</b><b>From</b><b>To</b><b>Amount</b><b>Action</b>
                    </div>
                    {transfers.map(t => (
                        <div key={t._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr 1fr 100px' }}>
                            <p>{new Date(t.date).toLocaleDateString()}</p>
                            <p>{t.fromAccountId?.accountName || '-'}</p>
                            <p>{t.toAccountId?.accountName || '-'}</p>
                            <p>₹{t.amount.toLocaleString('en-IN')}</p>
                            <div className="action-buttons"><p onClick={() => remove(t._id)} className="cursor delete-action">X</p></div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Add Transfer</h2>
                        <form onSubmit={submit}>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>From Account *</p>
                                    <StyledSelect
                                        value={form.fromAccountId} onChange={v => setField('fromAccountId', v)} placeholder="From account…"
                                        options={accounts.map(a => ({ value: a._id, label: a.accountName }))}
                                    />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>To Account *</p>
                                    <StyledSelect
                                        value={form.toAccountId} onChange={v => setField('toAccountId', v)} placeholder="To account…"
                                        options={accounts.map(a => ({ value: a._id, label: a.accountName }))}
                                    />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Amount (₹) *</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Date *</p>
                                    <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                                </div>
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Notes</p>
                                    <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                                </div>
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

export default BankTransfersManager;
