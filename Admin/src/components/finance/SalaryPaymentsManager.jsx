import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import StyledDatePicker from './StyledDatePicker';
import StyledMonthPicker from './StyledMonthPicker';
import StyledSelect from './StyledSelect';
import SettingSelectField, { registerSettingIfNew } from './SettingSelectField';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '' };
const thisMonth = () => new Date().toISOString().slice(0, 7);

// See SalaryLedgerView.jsx's identical helper — this is the other of the
// two entry points to the same financeSalaryPayment data, so it needs the
// exact same TDS handling or a payment recorded here silently has none.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const calcTds = (rate, amount) => (rate != null && amount ? round2((rate / 100) * Number(amount)) : '');

/*
 * Standalone salary-payment entry + history — the same financeSalaryPayment
 * data as Masters' Salary Ledger tab, reachable from the Payments page
 * directly without pulling in the expected-vs-paid breakdown. Requires
 * picking an employee and a pay month first.
 */
const SalaryPaymentsManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [employeeId, setEmployeeId] = useState('');
    const [month, setMonth] = useState(thisMonth());
    const [bankAccounts, setBankAccounts] = useState([]);
    const [paymentModes, setPaymentModes] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [payments, setPayments] = useState([]);
    const [balanceDue, setBalanceDue] = useState(null);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        Promise.all([
            axios.get(`${url}/api/finance/bank-accounts/list`, authHeader).then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'payment_mode' } })
                .then(res => { if (res.data.success) setPaymentModes(res.data.data.map(s => s.name)); }).catch(() => {}),
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
                .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {}),
        ]).finally(() => setRefDataLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/salary-payments/list`, { ...authHeader, params: { employeeId, month } });
            if (res.data.success) setPayments(res.data.data);
        } catch { toast.error('Error fetching salary payments'); }
        finally { setLoading(false); }
    };

    // Balance Due for this employee/month — same figure Masters' Salary
    // Ledger tab already shows, surfaced here too so it's visible right
    // where you're about to record a payment against it. See
    // LabourProviderPaymentsManager.jsx's identical fetchBalancePayable.
    const fetchBalanceDue = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/employees/${employeeId}/salary-ledger`, { ...authHeader, params: { month } });
            if (res.data.success) setBalanceDue(res.data.data.balanceDue);
        } catch { setBalanceDue(null); }
    };

    useEffect(() => {
        if (employeeId) { fetchPayments(); fetchBalanceDue(); } else { setPayments([]); setBalanceDue(null); }
    }, [employeeId, month]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment for this employee/month recorded elsewhere (Masters' Salary
    // Ledger tab, or this same tab in another browser tab/admin) wouldn't
    // otherwise show up here until reselected.
    useFinanceWsRefresh(['financeSalaryPaymentsChanged'], () => { if (employeeId) { fetchPayments(); fetchBalanceDue(); } });

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

    const submit = async (e) => {
        e.preventDefault();
        if (!employeeId) return toast.error('Select an employee');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/salary-payments/add`, { ...form, employeeId, month }, authHeader);
            if (res.data.success) {
                if (form.paymentMode) await registerSettingIfNew(url, authHeader, 'payment_mode', form.paymentMode, paymentModes.map(m => ({ name: m })));
                toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchPayments(); await fetchBalanceDue();
            }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording salary payment'); }
        finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/salary-payments/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchPayments(); await fetchBalanceDue(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing salary payment'); }
        finally { setDeleting(false); }
    };

    return (
        <div>
            <div className="wizard-field-grid" style={{ marginBottom: '20px' }}>
                <div className="add-product-name flex-col">
                    <p>Employee</p>
                    <QuickAddPicker url={url} resourceKey="employees" value={employeeId} onChange={setEmployeeId} placeholder="Select employee…" />
                </div>
                <div className="add-product-name flex-col">
                    <p>Month</p>
                    <StyledMonthPicker value={month} onChange={v => setMonth(v || thisMonth())} />
                </div>
            </div>

            {!employeeId ? (
                <div className="admin-empty-state"><p>Select an employee to record or view salary payments.</p></div>
            ) : (
                <>
                    <div className="pq-section-header" style={{ marginBottom: '8px' }}>
                        <h3 style={{ margin: 0 }}>Payments</h3>
                        <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Payment</button>
                    </div>
                    {balanceDue !== null && (
                        <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                            {balanceDue < 0 ? 'Extra Paid' : 'Balance Due'}: <span style={{ fontWeight: 700, color: balanceDue > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(balanceDue).toLocaleString('en-IN')}</span>
                        </p>
                    )}
                    {loading ? (
                        <div className="admin-empty-state"><p>Loading…</p></div>
                    ) : payments.length === 0 ? (
                        <div className="admin-empty-state"><p>No payments for {month} yet.</p></div>
                    ) : (
                        <div className="dash-chart-card spm-card">
                            <div className="spm-row spm-header">
                                <b className="spm-date">Date</b>
                                <b className="spm-amount">Amount</b>
                                <b className="spm-tds">TDS</b>
                                <b className="spm-mode">Mode</b>
                                <b className="spm-account">Account</b>
                                <b className="spm-action">Action</b>
                            </div>
                            {payments.map(p => (
                                <div key={p._id} className="spm-row">
                                    <p className="spm-date">{new Date(p.date).toLocaleDateString()}</p>
                                    <p className="spm-amount"><span className="pq-group-label">Amount</span>₹{p.amount.toLocaleString('en-IN')}</p>
                                    <p className="spm-tds"><span className="pq-group-label">TDS</span>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                                    <p className="spm-mode"><span className="pq-group-label">Mode</span>{p.paymentMode || '-'}</p>
                                    <p className="spm-account"><span className="pq-group-label">Account</span>{p.bankAccountId?.accountName || 'Cash'}</p>
                                    <div className="spm-action">
                                        <button type="button" className="pq-btn-ghost-danger" onClick={() => setConfirmItem(p)} title="Remove payment" aria-label="Remove payment">
                                            <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {modalOpen && ReactDOM.createPortal(
                        <div className="submit-loader-overlay spm-overlay" style={{ zIndex: 99999 }}>
                            <div className="loader-modal-box edit-modal spm-modal">
                                <div className="spm-modal-header">
                                    <h2>Add Payment</h2>
                                    {balanceDue !== null && (
                                        <p className="admin-subtitle" style={{ margin: '4px 0 0' }}>
                                            {balanceDue < 0 ? 'Extra Paid' : 'Payment Left'}: <span style={{ fontWeight: 700, color: balanceDue > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(balanceDue).toLocaleString('en-IN')}</span>
                                        </p>
                                    )}
                                </div>
                                <div className="spm-modal-body">
                                    <form id="spm-form" onSubmit={submit}>
                                        <div className="wizard-field-grid">
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
                                            <p className="admin-subtitle" style={{ margin: '12px 0 0' }}>
                                                Gross: ₹{Number(form.amount).toLocaleString('en-IN')}
                                                {form.tdsAmount > 0 && ` · TDS: ₹${Number(form.tdsAmount).toLocaleString('en-IN')} · Net Payable: ₹${(Number(form.amount) - Number(form.tdsAmount)).toLocaleString('en-IN')}`}
                                            </p>
                                        )}
                                    </form>
                                </div>
                                <div className="edit-modal-actions spm-modal-footer">
                                    <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                                    <button type="submit" form="spm-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </>
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this payment?</h3>
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

export default SalaryPaymentsManager;
