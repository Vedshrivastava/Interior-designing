import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import SettingSelectField, { registerSettingIfNew } from './SettingSelectField';
import { KpiCard, KpiGrid, formatINR } from './DashboardWidgets';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/dashboard.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '', projectId: '' };

/*
 * Labour Provider Ledger for one provider — mirrors CommissionLedgerView's
 * shape (earnings breakdown + payment form/history + computed payable),
 * but a provider's "earnings" are split across every labourer connected
 * to them (financeLabourer.labourProviderId), per work, using each
 * labourer's OWN reviewed/approved sqft on that work
 * × the provider's fixed rate for that labourer — never derived from or
 * deducted against the labourer's own pay (see
 * controllers/financeLabourProviderLedger.js). Approved Pay and Pay Left
 * to Approve are kept as two separate figures throughout, per how the
 * cut is earned: only reviewed sqft is actually payable, but unreviewed
 * sqft's prospective pay still needs to be visible.
 */
const LabourProviderLedgerView = ({ url, labourProviderId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [ledger, setLedger] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [paymentModes, setPaymentModes] = useState([]);
    const [projects, setProjects] = useState([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/labour-providers/${labourProviderId}/labour-provider-ledger`, authHeader);
            if (res.data.success) setLedger(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching labour provider ledger'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (labourProviderId) fetchLedger(); }, [labourProviderId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment for this labour provider recorded elsewhere (the standalone
    // Labour Provider Payment tab) wouldn't otherwise show up here until
    // reselected.
    useFinanceWsRefresh(['financeLabourProviderPaymentsChanged'], (msg) => { if (labourProviderId && (!msg.labourProviderId || msg.labourProviderId === labourProviderId)) fetchLedger(); });
    useEffect(() => {
        Promise.all([
            axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
                .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
                .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'payment_mode' } })
                .then(res => { if (res.data.success) setPaymentModes(res.data.data.map(s => s.name)); }).catch(() => {}),
            axios.get(`${url}/api/finance/projects/list`, authHeader)
                .then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {}),
        ]).finally(() => setRefDataLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/labour-provider-payments/add`, { ...form, labourProviderId }, authHeader);
            if (res.data.success) {
                if (form.paymentMode) await registerSettingIfNew(url, authHeader, 'payment_mode', form.paymentMode, paymentModes.map(m => ({ name: m })));
                toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchLedger();
            }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording labour provider payment'); }
        finally { setSaving(false); }
    };

    const confirmRemove = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/labour-provider-payments/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing labour provider payment'); }
        finally { setDeleting(false); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!ledger) return <div className="admin-empty-state"><p>Unable to load labour provider ledger.</p></div>;

    const { totals } = ledger;

    return (
        <div>
            <KpiGrid>
                <KpiCard label="Approved Pay" value={formatINR(totals.approvedPay)} tone="good" />
                <KpiCard label="Pay Left to Approve" value={formatINR(totals.pendingApprovalPay)} />
                <KpiCard label="Total Pay Done" value={formatINR(totals.paymentsTotal)} />
                <KpiCard label="Total Pay Left" value={formatINR(totals.balancePayable)} tone={totals.balancePayable > 0 ? 'danger' : 'good'} />
            </KpiGrid>

            <h3 style={{ margin: '20px 0 8px' }}>Earnings by Labourer &amp; Work</h3>
            {ledger.rows.length === 0 ? (
                <div className="admin-empty-state" style={{ marginBottom: '28px' }}><p>No work logged by this provider's labourers yet.</p></div>
            ) : (
                <div className="dash-chart-card lpe-card" style={{ marginBottom: '28px' }}>
                    <div className="lpe-row lpe-header">
                        <b className="lpe-labourer">Labourer</b>
                        <b className="lpe-project">Project</b>
                        <b className="lpe-type">Work Type</b>
                        <b className="lpe-total">Total Area</b>
                        <b className="lpe-approved">Approved</b>
                        <b className="lpe-pending">Pending</b>
                        <b className="lpe-rate">Rate</b>
                        <b className="lpe-approvedpay">Approved Pay</b>
                        <b className="lpe-pendingpay">Pending Pay</b>
                    </div>
                    {ledger.rows.map((r, i) => (
                        <div key={i} className="lpe-row">
                            <p className="lpe-labourer">{r.labourerName}</p>
                            <p className="lpe-project"><span className="pq-group-label">Project</span>{r.projectName}</p>
                            <p className="lpe-type"><span className="pq-group-label">Work Type</span>{r.workType}</p>
                            <p className="lpe-total"><span className="pq-group-label">Total Area</span>{r.totalAreaSqft} sqft</p>
                            <p className="lpe-approved"><span className="pq-group-label">Approved</span>{r.approvedAreaSqft} sqft</p>
                            <p className="lpe-pending"><span className="pq-group-label">Pending</span>{r.unapprovedAreaSqft} sqft</p>
                            <p className="lpe-rate"><span className="pq-group-label">Rate</span>₹{r.rate}/sqft</p>
                            <p className="lpe-approvedpay"><span className="pq-group-label">Approved Pay</span>₹{r.approvedPay.toLocaleString('en-IN')}</p>
                            <p className="lpe-pendingpay"><span className="pq-group-label">Pending Pay</span>₹{r.pendingPay.toLocaleString('en-IN')}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="pq-section-header">
                <h3 style={{ margin: 0 }}>Payments</h3>
                <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Payment</button>
            </div>
            {ledger.payments.length === 0 ? (
                <div className="admin-empty-state"><p>No payments yet.</p></div>
            ) : (
                <div className="dash-chart-card lpp-card">
                    <div className="lpp-row lpp-header">
                        <b className="lpp-date">Date</b>
                        <b className="lpp-amount">Amount</b>
                        <b className="lpp-mode">Mode</b>
                        <b className="lpp-account">Account</b>
                        <b className="lpp-tds">TDS</b>
                        <b className="lpp-actions">Action</b>
                    </div>
                    {ledger.payments.map(p => (
                        <div key={p._id} className="lpp-row">
                            <p className="lpp-date"><span className="pq-group-label">Date</span>{new Date(p.date).toLocaleDateString()}</p>
                            <p className="lpp-amount"><span className="pq-group-label">Amount</span>₹{p.amount.toLocaleString('en-IN')}</p>
                            <p className="lpp-mode"><span className="pq-group-label">Mode</span>{p.paymentMode || '-'}</p>
                            <p className="lpp-account"><span className="pq-group-label">Account</span>{p.bankAccountId?.accountName || 'Cash'}</p>
                            <p className="lpp-tds"><span className="pq-group-label">TDS</span>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                            <div className="action-buttons lpp-actions">
                                <button type="button" onClick={() => setConfirmItem(p)} className="pq-btn-ghost-danger" title="Remove payment" aria-label="Remove payment">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay lpp-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal lpp-modal">
                        <div className="lpp-modal-header">
                            <h2>Add Payment</h2>
                            <p className="admin-subtitle" style={{ margin: '4px 0 0' }}>
                                {totals.balancePayable < 0 ? 'Extra Paid' : 'Payment Left'}: <span style={{ fontWeight: 700, color: totals.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(totals.balancePayable).toLocaleString('en-IN')}</span>
                            </p>
                        </div>
                        <div className="lpp-modal-body">
                        <form id="labour-provider-payment-form" onSubmit={submit}>
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
                                    <p>Project (optional)</p>
                                    <StyledSelect
                                        value={form.projectId} onChange={v => setField('projectId', v)} placeholder="Not tied to a project" loading={refDataLoading}
                                        options={projects.map(p => ({ value: p._id, label: p.name }))}
                                    />
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
                        <div className="edit-modal-actions lpp-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button type="submit" form="labour-provider-payment-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this payment?</h3>
                        <p className="bin-confirm-name">₹{confirmItem.amount.toLocaleString('en-IN')}</p>
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

export default LabourProviderLedgerView;
