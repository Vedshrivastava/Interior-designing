import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import SettingSelectField, { registerSettingIfNew } from './SettingSelectField';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/dashboard.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { month: '', amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '' };
const thisMonth = () => new Date().toISOString().slice(0, 7);

// See ContractorLedgerView.jsx's identical helper. Manual pick here — no
// work-type derivation, an employee doesn't have one.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const calcTds = (rate, amount) => (rate != null && amount ? round2((rate / 100) * Number(amount)) : '');

/*
 * Salary Ledger for one employee — expected salary vs. paid, per month,
 * plus the add/remove payment form. Balance Due = employee.salary −
 * SUM(payments for that month), computed fresh on every call — see
 * controllers/financeSalaryLedger.js.
 */
const SalaryLedgerView = ({ url, employeeId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [ledger, setLedger] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [paymentModes, setPaymentModes] = useState([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [form, setForm] = useState({ ...emptyForm, month: thisMonth() });
    const [saving, setSaving] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/employees/${employeeId}/salary-ledger`, authHeader);
            if (res.data.success) setLedger(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching salary ledger'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (employeeId) fetchLedger(); }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment for this employee recorded elsewhere (the standalone
    // Salary Payment tab) wouldn't otherwise show up here until reselected.
    useFinanceWsRefresh(['financeSalaryPaymentsChanged'], (msg) => { if (employeeId && (!msg.employeeId || msg.employeeId === employeeId)) fetchLedger(); });
    useEffect(() => {
        Promise.all([
            axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
                .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
                .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'payment_mode' } })
                .then(res => { if (res.data.success) setPaymentModes(res.data.data.map(s => s.name)); }).catch(() => {}),
        ]).finally(() => setRefDataLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const onChangeAmount = (amount) => {
        setForm(p => {
            const section = tdsSections.find(s => s._id === p.tdsSectionId);
            return { ...p, amount, tdsAmount: p.tdsSectionId ? calcTds(section?.rate, amount) : p.tdsAmount };
        });
    };
    const onChangeTdsSection = (tdsSectionId) => {
        setForm(p => {
            const section = tdsSections.find(s => s._id === tdsSectionId);
            return { ...p, tdsSectionId, tdsAmount: tdsSectionId ? calcTds(section?.rate, p.amount) : '' };
        });
    };

    const submit = async () => {
        if (!/^\d{4}-\d{2}$/.test(form.month)) return toast.error('A valid month is required');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/salary-payments/add`, { ...form, employeeId }, authHeader);
            if (res.data.success) {
                if (form.paymentMode) await registerSettingIfNew(url, authHeader, 'payment_mode', form.paymentMode, paymentModes.map(m => ({ name: m })));
                toast.success(res.data.message); setForm({ ...emptyForm, month: thisMonth() }); await fetchLedger();
            }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording salary payment'); }
        finally { setSaving(false); }
    };

    const confirmRemove = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/salary-payments/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing salary payment'); }
        finally { setDeleting(false); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!ledger) return <div className="admin-empty-state"><p>Unable to load salary ledger.</p></div>;

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>
                Expected salary: ₹{ledger.expectedSalary.toLocaleString('en-IN')}/month
                {ledger.tdsTotal > 0 && ` · Total TDS withheld to date: ₹${ledger.tdsTotal.toLocaleString('en-IN')} (already included in Paid below, not cash in hand).`}
            </p>

            <div className="wizard-step-body">
                <p className="wizard-section-label">Add Payment</p>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Month *</p>
                        <input type="month" value={form.month} onChange={e => setField('month', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Amount (₹) *</p>
                        <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.amount} onChange={e => onChangeAmount(e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Date *</p>
                        <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Payment Mode</p>
                        <SettingSelectField settingType="payment_mode" options={paymentModes.map(m => ({ _id: m, name: m }))}
                            value={form.paymentMode} onChange={v => setField('paymentMode', v)} placeholder="e.g. Cash, Bank Transfer, UPI…" />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Bank Account</p>
                        <StyledSelect
                            value={form.bankAccountId} onChange={v => setField('bankAccountId', v)} placeholder="Cash" loading={refDataLoading}
                            options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                        />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>TDS Section</p>
                        <StyledSelect
                            value={form.tdsSectionId} onChange={onChangeTdsSection} placeholder="No TDS" loading={refDataLoading}
                            options={tdsSections.map(s => ({ value: s._id, label: `${s.name}${s.rate != null ? ` (${s.rate}%)` : ''}` }))}
                        />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>TDS Amount</p>
                        <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.tdsAmount} onChange={e => setField('tdsAmount', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>UTR / Reference Number</p>
                        <input type="text" value={form.utrNumber} onChange={e => setField('utrNumber', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col wizard-field-full">
                        <p>Notes</p>
                        <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                    </div>
                </div>
                {form.amount > 0 && (
                    <p className="admin-subtitle" style={{ margin: '8px 0 0' }}>
                        Gross: ₹{Number(form.amount).toLocaleString('en-IN')}
                        {form.tdsAmount > 0 && ` · TDS: ₹${Number(form.tdsAmount).toLocaleString('en-IN')} · Net Payable: ₹${(Number(form.amount) - Number(form.tdsAmount)).toLocaleString('en-IN')}`}
                    </p>
                )}
                <div className="wizard-actions" style={{ marginTop: '16px', marginBottom: '12px' }}>
                    <span />
                    <button type="button" className="add-btn" disabled={saving} onClick={submit}>{saving ? 'Saving…' : '+ Add Payment'}</button>
                </div>
            </div>

            <h3 style={{ margin: '20px 0 8px' }}>By Month</h3>
            {ledger.months.length === 0 ? (
                <div className="admin-empty-state" style={{ marginBottom: '24px' }}><p>No salary payments yet.</p></div>
            ) : (
                <div className="dash-chart-card sal-card" style={{ marginBottom: '24px' }}>
                    <div className="sal-row sal-header">
                        <b className="sal-month">Month</b>
                        <b className="sal-expected">Expected</b>
                        <b className="sal-paid">Paid</b>
                        <b className="sal-balance">Balance Due</b>
                    </div>
                    {ledger.months.map(m => (
                        <div key={m.month} className="sal-row">
                            <p className="sal-month">{m.month}</p>
                            <p className="sal-expected"><span className="pq-group-label">Expected</span>₹{m.expectedSalary.toLocaleString('en-IN')}</p>
                            <p className="sal-paid"><span className="pq-group-label">Paid</span>₹{m.paid.toLocaleString('en-IN')}</p>
                            <p className="sal-balance" style={{ color: m.balanceDue > 0 ? '#c0392b' : 'var(--moss)' }}><span className="pq-group-label">Balance Due</span>₹{m.balanceDue.toLocaleString('en-IN')}</p>
                        </div>
                    ))}
                </div>
            )}

            <h3 style={{ marginBottom: '8px' }}>Payment History</h3>
            {ledger.payments.length === 0 ? (
                <div className="admin-empty-state"><p>No payments recorded yet.</p></div>
            ) : (
                <div className="dash-chart-card salp-card">
                    <div className="salp-row salp-header">
                        <b className="salp-month">Month</b>
                        <b className="salp-date">Date</b>
                        <b className="salp-amount">Amount</b>
                        <b className="salp-account">Account</b>
                        <b className="salp-tds">TDS</b>
                        <b className="salp-actions">Action</b>
                    </div>
                    {ledger.payments.map(p => (
                        <div key={p._id} className="salp-row">
                            <p className="salp-month">{p.month}</p>
                            <p className="salp-date"><span className="pq-group-label">Date</span>{new Date(p.date).toLocaleDateString()}</p>
                            <p className="salp-amount"><span className="pq-group-label">Amount</span>₹{p.amount.toLocaleString('en-IN')}</p>
                            <p className="salp-account"><span className="pq-group-label">Account</span>{p.bankAccountId?.accountName || 'Cash'}</p>
                            <p className="salp-tds"><span className="pq-group-label">TDS</span>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                            <div className="action-buttons salp-actions">
                                <button type="button" onClick={() => setConfirmItem(p)} className="pq-btn-ghost-danger" title="Remove payment" aria-label="Remove payment">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this salary payment?</h3>
                        <p className="bin-confirm-name">{confirmItem.month} — ₹{confirmItem.amount.toLocaleString('en-IN')}</p>
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

export default SalaryLedgerView;
