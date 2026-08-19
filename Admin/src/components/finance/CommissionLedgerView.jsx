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
import { measurementUnitLabel } from '../../config/financeMasters';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/dashboard.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '', projectId: '' };

/*
 * Commission Ledger for one referral — earnings breakdown (from
 * financeWork × referralRatePerSqft across the projects they referred),
 * payment form/history, and the computed Commission Payable. Mirrors
 * ContractorLedgerView/VendorLedgerView's shape. A referral is its own
 * collection (financeReferral), not a vendor.
 */
const CommissionLedgerView = ({ url, referralId }) => {
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
            const res = await axios.get(`${url}/api/finance/referrals/${referralId}/commission-ledger`, authHeader);
            if (res.data.success) setLedger(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching commission ledger'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (referralId) fetchLedger(); }, [referralId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment for this referral recorded elsewhere (the standalone
    // Commission Payment tab) wouldn't otherwise show up here until reselected.
    useFinanceWsRefresh(['financeCommissionPaymentsChanged'], (msg) => { if (referralId && (!msg.referralId || msg.referralId === referralId)) fetchLedger(); });
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
            const res = await axios.post(`${url}/api/finance/commission-payments/add`, { ...form, referralId }, authHeader);
            if (res.data.success) {
                if (form.paymentMode) await registerSettingIfNew(url, authHeader, 'payment_mode', form.paymentMode, paymentModes.map(m => ({ name: m })));
                toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchLedger();
            }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording commission payment'); }
        finally { setSaving(false); }
    };

    const confirmRemove = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/commission-payments/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing commission payment'); }
        finally { setDeleting(false); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!ledger) return <div className="admin-empty-state"><p>Unable to load commission ledger.</p></div>;

    const { totals } = ledger;

    return (
        <div>
            <KpiGrid>
                <KpiCard label="Total (All Logged)" value={formatINR(totals.totalAmount)} />
                <KpiCard label="Approved (Reviewed)" value={totals.earnings > 0 ? formatINR(totals.earnings) : 'Unapproved'} tone={totals.earnings > 0 ? 'good' : undefined} />
                <KpiCard label="Unapproved" value={formatINR(totals.unapprovedAmount)} tone={totals.unapprovedAmount > 0 ? 'danger' : undefined} />
                <KpiCard label="Payments" value={formatINR(totals.payments)} />
                <KpiCard label="Commission Payable" value={formatINR(totals.commissionPayable)} tone={totals.commissionPayable > 0 ? 'danger' : 'good'} />
            </KpiGrid>
            {totals.unapprovedAmount > 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                    ₹{totals.unapprovedAmount.toLocaleString('en-IN')} worth of referred work hasn't been reviewed yet; it isn't counted as Approved commission until it's reviewed (Payables/Receivables → Deductions).
                </p>
            )}

            <h3 style={{ marginBottom: '8px' }}>Earnings by Work</h3>
            {ledger.works.length === 0 ? (
                <div className="admin-empty-state" style={{ marginBottom: '28px' }}><p>No referred works yet.</p></div>
            ) : (
                <div className="dash-chart-card cme-card" style={{ marginBottom: '28px' }}>
                    <div className="cme-row cme-header">
                        <b className="cme-project">Project</b>
                        <b className="cme-type">Work Type</b>
                        <b className="cme-area">Completed Area</b>
                        <b className="cme-cut">Referral Cut</b>
                        <b className="cme-approved">Approved</b>
                        <b className="cme-unapproved">Unapproved</b>
                    </div>
                    {ledger.works.map(w => {
                        const wUnitLabel = measurementUnitLabel(w.unit);
                        return (
                        <div key={w._id} className="cme-row">
                            <p className="cme-project">{w.projectName}</p>
                            <p className="cme-type"><span className="pq-group-label">Work Type</span>{w.workType}</p>
                            <p className="cme-area"><span className="pq-group-label">Completed Area</span>{w.completedAreaSqft} {wUnitLabel}</p>
                            <p className="cme-cut"><span className="pq-group-label">Referral Cut</span>{w.referralRatePerSqft != null ? `₹${w.referralRatePerSqft}/${wUnitLabel}` : <span title="No matching work type rate configured">(no rate)</span>}</p>
                            <p className="cme-approved" style={{ color: w.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}>
                                <span className="pq-group-label">Approved</span>
                                {w.earnings > 0
                                    ? <>₹{w.earnings.toLocaleString('en-IN')} <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>({w.approvedAreaSqft} {wUnitLabel}{w.approvedDate ? `, ${new Date(w.approvedDate).toLocaleDateString()}` : ''})</span></>
                                    : 'Unapproved'}
                            </p>
                            <p className="cme-unapproved" style={{ color: w.unapprovedAmount > 0 ? '#c0392b' : 'var(--text-lt)' }}><span className="pq-group-label">Unapproved</span>{w.referralRatePerSqft != null ? `₹${w.unapprovedAmount.toLocaleString('en-IN')}` : '-'}</p>
                        </div>
                        );
                    })}
                </div>
            )}

            <div className="pq-section-header">
                <h3 style={{ margin: 0 }}>Payments</h3>
                <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Payment</button>
            </div>
            {ledger.payments.length === 0 ? (
                <div className="admin-empty-state"><p>No payments yet.</p></div>
            ) : (
                <div className="dash-chart-card cmp-card">
                    <div className="cmp-row cmp-header">
                        <b className="cmp-date">Date</b>
                        <b className="cmp-amount">Amount</b>
                        <b className="cmp-mode">Mode</b>
                        <b className="cmp-account">Account</b>
                        <b className="cmp-tds">TDS</b>
                        <b className="cmp-actions">Action</b>
                    </div>
                    {ledger.payments.map(p => (
                        <div key={p._id} className="cmp-row">
                            <p className="cmp-date"><span className="pq-group-label">Date</span>{new Date(p.date).toLocaleDateString()}</p>
                            <p className="cmp-amount"><span className="pq-group-label">Amount</span>₹{p.amount.toLocaleString('en-IN')}</p>
                            <p className="cmp-mode"><span className="pq-group-label">Mode</span>{p.paymentMode || '-'}</p>
                            <p className="cmp-account"><span className="pq-group-label">Account</span>{p.bankAccountId?.accountName || 'Cash'}</p>
                            <p className="cmp-tds"><span className="pq-group-label">TDS</span>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                            <div className="action-buttons cmp-actions">
                                <button type="button" onClick={() => setConfirmItem(p)} className="pq-btn-ghost-danger" title="Remove payment" aria-label="Remove payment">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay cmp-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal cmp-modal">
                        <div className="cmp-modal-header">
                            <h2>Add Payment</h2>
                            <p className="admin-subtitle" style={{ margin: '4px 0 0' }}>
                                Payment Left: <span style={{ fontWeight: 700, color: totals.commissionPayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(totals.commissionPayable).toLocaleString('en-IN')}</span>
                            </p>
                        </div>
                        <div className="cmp-modal-body">
                        <form id="commission-payment-form" onSubmit={submit}>
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
                        <div className="edit-modal-actions cmp-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button type="submit" form="commission-payment-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
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

export default CommissionLedgerView;
