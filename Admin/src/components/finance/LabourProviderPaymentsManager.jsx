import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import SettingSelectField, { registerSettingIfNew } from './SettingSelectField';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '' };

/*
 * Standalone labour-provider payment entry + history — the same
 * financeLabourProviderPayment data as Labourers' Labour Provider Ledger
 * tab, reachable from the Payments page directly without pulling in the
 * earnings breakdown. Mirrors CommissionPaymentsManager exactly.
 */
const LabourProviderPaymentsManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [labourProviderId, setLabourProviderId] = useState('');
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [paymentModes, setPaymentModes] = useState([]);
    const [payments, setPayments] = useState([]);
    const [balancePayable, setBalancePayable] = useState(null);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

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

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/labour-provider-payments/list`, { ...authHeader, params: { labourProviderId } });
            if (res.data.success) setPayments(res.data.data);
        } catch { toast.error('Error fetching labour provider payments'); }
        finally { setLoading(false); }
    };

    // Balance Payable — same figure the Labour Provider Ledger tab already
    // shows, surfaced here too so it's visible right where you're about to
    // record a payment against it. See VendorPaymentsManager.jsx's
    // identical fetchAmountOwed.
    const fetchBalancePayable = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/labour-providers/${labourProviderId}/labour-provider-ledger`, authHeader);
            if (res.data.success) setBalancePayable(res.data.data.totals.balancePayable);
        } catch { setBalancePayable(null); }
    };

    useEffect(() => {
        if (labourProviderId) { fetchPayments(); fetchBalancePayable(); } else { setPayments([]); setBalancePayable(null); }
    }, [labourProviderId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment for this labour provider recorded elsewhere wouldn't
    // otherwise show up here until reselected.
    useFinanceWsRefresh(['financeLabourProviderPaymentsChanged'], () => { if (labourProviderId) { fetchPayments(); fetchBalancePayable(); } });

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!labourProviderId) return toast.error('Select a labour provider');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/labour-provider-payments/add`, { ...form, labourProviderId }, authHeader);
            if (res.data.success) {
                if (form.paymentMode) await registerSettingIfNew(url, authHeader, 'payment_mode', form.paymentMode, paymentModes.map(m => ({ name: m })));
                toast.success(res.data.message); setForm(emptyForm); setModalOpen(false);
                await fetchPayments(); await fetchBalancePayable();
            }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording labour provider payment'); }
        finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/labour-provider-payments/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchPayments(); await fetchBalancePayable(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing labour provider payment'); }
        finally { setDeleting(false); }
    };

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
                <p>Labour Provider</p>
                <QuickAddPicker url={url} resourceKey="labourProviders" value={labourProviderId} onChange={setLabourProviderId}
                    placeholder="Select labour provider…" />
            </div>

            {!labourProviderId ? (
                <div className="admin-empty-state"><p>Select a labour provider to record or view payments.</p></div>
            ) : (
                <>
                    <div className="pq-section-header" style={{ marginBottom: '8px' }}>
                        <h3 style={{ margin: 0 }}>Payments</h3>
                        <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Payment</button>
                    </div>
                    {balancePayable !== null && (
                        <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                            {balancePayable < 0 ? 'Extra Paid' : 'Balance Payable'}: <span style={{ fontWeight: 700, color: balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(balancePayable).toLocaleString('en-IN')}</span>
                        </p>
                    )}
                    {loading ? (
                        <div className="admin-empty-state"><p>Loading…</p></div>
                    ) : payments.length === 0 ? (
                        <div className="admin-empty-state"><p>No payments recorded yet.</p></div>
                    ) : (
                        <div className="dash-chart-card lppm-card">
                            <div className="lppm-row lppm-header">
                                <b className="lppm-date">Date</b>
                                <b className="lppm-amount">Amount</b>
                                <b className="lppm-mode">Mode</b>
                                <b className="lppm-account">Account</b>
                                <b className="lppm-tds">TDS</b>
                                <b className="lppm-action">Action</b>
                            </div>
                            {payments.map(p => (
                                <div key={p._id} className="lppm-row">
                                    <p className="lppm-date">{new Date(p.date).toLocaleDateString()}</p>
                                    <p className="lppm-amount"><span className="pq-group-label">Amount</span>₹{p.amount.toLocaleString('en-IN')}</p>
                                    <p className="lppm-mode"><span className="pq-group-label">Mode</span>{p.paymentMode || '-'}</p>
                                    <p className="lppm-account"><span className="pq-group-label">Account</span>{p.bankAccountId?.accountName || 'Cash'}</p>
                                    <p className="lppm-tds"><span className="pq-group-label">TDS</span>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                                    <div className="lppm-action">
                                        <button type="button" className="pq-btn-ghost-danger" onClick={() => setConfirmItem(p)} title="Remove payment" aria-label="Remove payment">
                                            <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {modalOpen && ReactDOM.createPortal(
                        <div className="submit-loader-overlay lppm-overlay" style={{ zIndex: 99999 }}>
                            <div className="loader-modal-box edit-modal lppm-modal">
                                <div className="lppm-modal-header">
                                    <h2>Add Payment</h2>
                                    {balancePayable !== null && (
                                        <p className="admin-subtitle" style={{ margin: '4px 0 0' }}>
                                            {balancePayable < 0 ? 'Extra Paid' : 'Payment Left'}: <span style={{ fontWeight: 700, color: balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(balancePayable).toLocaleString('en-IN')}</span>
                                        </p>
                                    )}
                                </div>
                                <div className="lppm-modal-body">
                                    <form id="lppm-form" onSubmit={submit}>
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
                                                    value={form.tdsSectionId} onChange={v => setField('tdsSectionId', v)} placeholder="No TDS" loading={refDataLoading}
                                                    options={tdsSections.map(s => ({ value: s._id, label: `${s.name}${s.code ? ` (${s.code})` : ''}` }))}
                                                />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>TDS Amount (optional)</p>
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
                                    </form>
                                </div>
                                <div className="edit-modal-actions lppm-modal-footer">
                                    <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                                    <button type="submit" form="lppm-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
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

export default LabourProviderPaymentsManager;
