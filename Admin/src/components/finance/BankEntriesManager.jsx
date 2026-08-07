import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { type: 'in', date: '', amount: '', bankAccountId: '', projectId: '', reason: '', notes: '' };

/*
 * Manual bank entries — the bank-account equivalent of Cash Book's Cash
 * In/Cash Out (CashEntriesManager.jsx), for money moving into/out of a
 * bank account with no originating receipt/payment/transfer behind it:
 * capital injected, a loan disbursed into the account, interest credited,
 * or a correction against the real bank statement. Every entry here is
 * always manual (financeBankEntry.js has no auto-generated case at all,
 * unlike financeCashEntry) — no read-only "Auto" rows to filter out.
 *
 * One unified tab with a Type toggle in the form (rather than mirroring
 * Cash Book's separate Cash In/Cash Out tabs exactly) since a bank entry
 * already has an extra required dimension — which account — that a Cash
 * entry doesn't; two more tabs on top of that would just be duplicated
 * account-select plumbing for no real benefit.
 */
const BankEntriesManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [accounts, setAccounts] = useState([]);
    const [accountsLoading, setAccountsLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [filterAccountId, setFilterAccountId] = useState('');
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
            const params = filterAccountId ? { bankAccountId: filterAccountId } : {};
            const res = await axios.get(`${url}/api/finance/bank-entries/list`, { ...authHeader, params });
            if (res.data.success) setEntries(res.data.data);
        } catch { toast.error('Error fetching bank entries'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchEntries(); }, [filterAccountId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeBankAccountsChanged'], fetchEntries);

    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setAccounts(res.data.data); })
            .catch(() => {})
            .finally(() => setAccountsLoading(false));
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.bankAccountId) return toast.error('Bank account is required');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.reason.trim()) return toast.error('Reason is required');
        if (!form.date) return toast.error('Date is required');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/bank-entries/add`, form, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording entry'); }
        finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/bank-entries/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing entry'); }
        finally { setDeleting(false); }
    };

    return (
        <div>
            <div className="pq-section-header" style={{ marginBottom: '8px' }}>
                <h3 style={{ margin: 0 }}>Manual Bank Entries</h3>
                <button type="button" className="add-btn" onClick={() => { setForm(emptyForm); setModalOpen(true); }}>+ Add Bank Entry</button>
            </div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                For money moving into/out of an account with no receipt, payment, or transfer behind it — capital injected, a loan disbursed, interest credited, or a correction against the real bank statement.
            </p>

            <div className="wizard-field-grid" style={{ marginBottom: '16px', maxWidth: '360px' }}>
                <div className="add-product-name flex-col">
                    <p>Filter by Account</p>
                    <StyledSelect
                        value={filterAccountId} onChange={setFilterAccountId} placeholder="All Accounts" loading={accountsLoading}
                        options={accounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                    />
                </div>
            </div>

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : entries.length === 0 ? (
                <div className="admin-empty-state"><p>No manual bank entries yet.</p></div>
            ) : (
                <div className="dash-chart-card cem-card">
                    <div className="cem-row cem-header">
                        <b className="cem-date">Date</b>
                        <b className="cem-amount">Amount</b>
                        <b className="cem-reason">Reason</b>
                        <b className="cem-source">Account</b>
                        <b className="cem-action">Action</b>
                    </div>
                    {entries.map(e => (
                        <div key={e._id} className="cem-row">
                            <p className="cem-date">{new Date(e.date).toLocaleDateString()}</p>
                            <p className="cem-amount">
                                <span className="pq-group-label">Amount</span>
                                <span style={{ color: e.type === 'in' ? 'var(--moss)' : '#c0392b' }}>{e.type === 'in' ? '+' : '−'}₹{e.amount.toLocaleString('en-IN')}</span>
                            </p>
                            <p className="cem-reason"><span className="pq-group-label">Reason</span>{e.reason}</p>
                            <p className="cem-source"><span className="pq-group-label">Account</span>{e.bankAccountId?.accountName || '—'}</p>
                            <div className="cem-action">
                                <button type="button" className="pq-btn-ghost-danger" onClick={() => setConfirmItem(e)} title="Remove entry" aria-label="Remove entry">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay cem-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal cem-modal">
                        <div className="cem-modal-header">
                            <h2>Add Bank Entry</h2>
                        </div>
                        <div className="cem-modal-body">
                            <form id="bem-form" onSubmit={submit}>
                                <div className="wizard-field-grid">
                                    <div className="add-product-name flex-col">
                                        <p>Type *</p>
                                        <div className="measurement-type-toggle" style={{ margin: 0 }}>
                                            <button type="button" className={`labour-chip${form.type === 'in' ? ' active' : ''}`} onClick={() => setField('type', 'in')}>Money In</button>
                                            <button type="button" className={`labour-chip${form.type === 'out' ? ' active' : ''}`} onClick={() => setField('type', 'out')}>Money Out</button>
                                        </div>
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Bank Account *</p>
                                        <StyledSelect
                                            value={form.bankAccountId} onChange={v => setField('bankAccountId', v)} placeholder="Select account…" loading={accountsLoading}
                                            options={accounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
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
                                    <div className="add-product-name flex-col">
                                        <p>Project</p>
                                        <select value={form.projectId} onChange={e => setField('projectId', e.target.value)}>
                                            <option value="">No project (general)</option>
                                            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="add-product-name flex-col wizard-field-full">
                                        <p>Reason *</p>
                                        <input type="text" placeholder={form.type === 'in' ? 'e.g. capital injected, loan disbursed, interest credited' : 'e.g. owner draw, bank charges'} value={form.reason} onChange={e => setField('reason', e.target.value)} />
                                    </div>
                                    <div className="add-product-name flex-col wizard-field-full">
                                        <p>Notes</p>
                                        <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="edit-modal-actions cem-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button type="submit" form="bem-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
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
                        <p className="bin-confirm-warning">This can&apos;t be undone.</p>
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

export default BankEntriesManager;
