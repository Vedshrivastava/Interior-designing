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

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', notes: '', workId: '', projectId: '', tdsSectionId: '', tdsAmount: '' };

// See ContractorLedgerView.jsx's identical helper.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const calcTds = (rate, amount) => (rate != null && amount ? round2((rate / 100) * Number(amount)) : '');

/*
 * Standalone labour-payment entry + history — the same financeLabourPayment
 * data as the Payments section inside LabourLedgerView, just reachable from
 * the Payments page directly without pulling in the rest of the ledger
 * (earnings/advances/deductions). Requires picking a labourer first, same
 * picker pattern as every other Payments tab. financeLabourPayment has no
 * utrNumber/attachment fields (unlike Contractor Payment) — see that
 * model's own comment.
 */
const LabourPaymentsManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [labourerId, setLabourerId] = useState('');
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [workTypeSettings, setWorkTypeSettings] = useState([]);
    const [works, setWorks] = useState([]);
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
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
            .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'payment_mode' } })
            .then(res => { if (res.data.success) setPaymentModes(res.data.data.map(s => s.name)); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'work_type' } })
            .then(res => { if (res.data.success) setWorkTypeSettings(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // This picker has no ledger loaded (unlike LabourLedgerView), so the
    // Work picker's options come from this labourer's own assignments
    // directly — see ContractorPaymentsManager.jsx's identical comment.
    useEffect(() => {
        if (!labourerId) { setWorks([]); return; }
        axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { labourerId } })
            .then(res => { if (res.data.success) setWorks(res.data.data.filter(a => a.workId)); }).catch(() => {});
    }, [url, labourerId]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/labour-payments/list`, { ...authHeader, params: { labourerId } });
            if (res.data.success) setPayments(res.data.data);
        } catch { toast.error('Error fetching payments'); }
        finally { setLoading(false); }
    };

    // Balance Payable — same figure LabourLedgerView.jsx already shows,
    // surfaced here too so it's visible right where you're about to record
    // a payment against it. See VendorPaymentsManager.jsx's identical
    // fetchAmountOwed.
    const fetchBalancePayable = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/labourer-ledger/${labourerId}/ledger`, authHeader);
            if (res.data.success) setBalancePayable(res.data.data.totals.balancePayable);
        } catch { setBalancePayable(null); }
    };

    useEffect(() => {
        if (labourerId) { fetchPayments(); fetchBalancePayable(); } else { setPayments([]); setBalancePayable(null); }
    }, [labourerId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment for this labourer recorded elsewhere (LabourLedgerView, or
    // this same tab in another browser tab/admin) wouldn't otherwise show
    // up here until the labourer was reselected.
    useFinanceWsRefresh(['financeLabourLedgerChanged'], () => { if (labourerId) { fetchPayments(); fetchBalancePayable(); } });

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    // See ContractorPaymentsManager.jsx's identical handlers.
    const onSelectWork = (workId) => {
        const assignment = works.find(a => a.workId?._id === workId);
        const workType = workTypeSettings.find(t => t.name === assignment?.workId?.workType);
        const section = workType?.tdsSectionId || null;
        setForm(p => ({
            ...p, workId, projectId: assignment?.workId?.projectId?._id || '',
            tdsSectionId: section?._id || '', tdsAmount: calcTds(section?.rate, p.amount),
        }));
    };
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
        if (!labourerId) return toast.error('Select a labourer');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/labour-payments/add`, { ...form, labourerId }, authHeader);
            if (res.data.success) {
                if (form.paymentMode) await registerSettingIfNew(url, authHeader, 'payment_mode', form.paymentMode, paymentModes.map(m => ({ name: m })));
                toast.success(res.data.message); setForm(emptyForm); setModalOpen(false);
                await fetchPayments(); await fetchBalancePayable();
            }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording payment'); }
        finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/labour-payments/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchPayments(); await fetchBalancePayable(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing payment'); }
        finally { setDeleting(false); }
    };

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
                <p>Labourer</p>
                <QuickAddPicker url={url} resourceKey="labourers" value={labourerId} onChange={setLabourerId} placeholder="Select labourer…" />
            </div>

            {!labourerId ? (
                <div className="admin-empty-state"><p>Select a labourer to record or view payments.</p></div>
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
                        <div className="dash-chart-card lpm-card">
                            <div className="lpm-row lpm-header">
                                <b className="lpm-date">Date</b>
                                <b className="lpm-amount">Amount</b>
                                <b className="lpm-mode">Mode</b>
                                <b className="lpm-account">Account</b>
                                <b className="lpm-tds">TDS</b>
                                <b className="lpm-action">Action</b>
                            </div>
                            {payments.map(p => (
                                <div key={p._id} className="lpm-row">
                                    <p className="lpm-date">{new Date(p.date).toLocaleDateString()}</p>
                                    <p className="lpm-amount"><span className="pq-group-label">Amount</span>₹{p.amount.toLocaleString('en-IN')}</p>
                                    <p className="lpm-mode"><span className="pq-group-label">Mode</span>{p.paymentMode || '-'}</p>
                                    <p className="lpm-account"><span className="pq-group-label">Account</span>{p.bankAccountId?.accountName || 'Cash'}</p>
                                    <p className="lpm-tds"><span className="pq-group-label">TDS</span>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                                    <div className="lpm-action">
                                        <button type="button" className="pq-btn-ghost-danger" onClick={() => setConfirmItem(p)} title="Remove payment" aria-label="Remove payment">
                                            <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {modalOpen && ReactDOM.createPortal(
                        <div className="submit-loader-overlay lpm-overlay" style={{ zIndex: 99999 }}>
                            <div className="loader-modal-box edit-modal lpm-modal">
                                <div className="lpm-modal-header">
                                    <h2>Add Payment</h2>
                                    {balancePayable !== null && (
                                        <p className="admin-subtitle" style={{ margin: '4px 0 0' }}>
                                            {balancePayable < 0 ? 'Extra Paid' : 'Payment Left'}: <span style={{ fontWeight: 700, color: balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(balancePayable).toLocaleString('en-IN')}</span>
                                        </p>
                                    )}
                                </div>
                                <div className="lpm-modal-body">
                                    <form id="lpm-form" onSubmit={submit}>
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
                                                <p>Work (optional — resolves TDS from its type)</p>
                                                <StyledSelect
                                                    value={form.workId} onChange={onSelectWork} placeholder="Not tied to a Work"
                                                    options={works.map(a => ({ value: a.workId._id, label: `${a.workId.workType} — ${a.workId.projectId?.name || '—'}` }))}
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
                                                    value={form.bankAccountId} onChange={v => setField('bankAccountId', v)} placeholder="Cash"
                                                    options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                                                />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>TDS Section</p>
                                                <StyledSelect
                                                    value={form.tdsSectionId} onChange={onChangeTdsSection} placeholder="No TDS"
                                                    options={tdsSections.map(s => ({ value: s._id, label: `${s.name}${s.rate != null ? ` (${s.rate}%)` : ''}` }))}
                                                />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>TDS Amount</p>
                                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.tdsAmount} onChange={e => setField('tdsAmount', e.target.value)} />
                                            </div>
                                            <div className="add-product-name flex-col wizard-field-full">
                                                <p>Notes</p>
                                                <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                                            </div>
                                            <div className="add-product-name flex-col wizard-field-full">
                                                <p>Bank / Cash Label (legacy, optional)</p>
                                                <input type="text" value={form.bankOrCashLabel} onChange={e => setField('bankOrCashLabel', e.target.value)} />
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
                                <div className="edit-modal-actions lpm-modal-footer">
                                    <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                                    <button type="submit" form="lpm-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
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

export default LabourPaymentsManager;
