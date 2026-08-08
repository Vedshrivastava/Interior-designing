import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import SettingSelectField, { registerSettingIfNew } from './SettingSelectField';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import ViewAttachmentLink from './ViewAttachmentLink';
import { extraPaidSub } from './DashboardWidgets';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', workId: '', projectId: '', tdsSectionId: '', tdsAmount: '', holdingPercent: '', holdingAmount: '' };

// See ContractorLedgerView.jsx's identical helper.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const calcTds = (rate, amount) => (rate != null && amount ? round2((rate / 100) * Number(amount)) : '');

/*
 * Standalone contractor-payment entry + history — the same
 * financeContractorPayment data as the Payments section inside
 * ContractorLedgerView, just reachable from the Payments page directly
 * without pulling in the rest of the ledger (earnings/advances/deductions).
 * Requires picking a contractor first, same picker pattern used elsewhere.
 */
const ContractorPaymentsManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [vendorId, setVendorId] = useState('');
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [workTypeSettings, setWorkTypeSettings] = useState([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [works, setWorks] = useState([]);
    const [worksLoading, setWorksLoading] = useState(false);
    const [paymentModes, setPaymentModes] = useState([]);
    const [payments, setPayments] = useState([]);
    // Full ledger totals, not just the one number — the breakdown below
    // (extraPaidSub) needs advances/payments/directPaymentTotal/earnings/
    // deductions/materialWasteTotal too, all of which the ledger endpoint
    // already returns; this used to discard everything but balancePayable.
    const [totals, setTotals] = useState(null);
    const [loading, setLoading] = useState(false);
    const balancePayable = totals?.balancePayable ?? null;

    const [form, setForm] = useState(emptyForm);
    const [file, setFile] = useState(null);
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
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'work_type' } })
                .then(res => { if (res.data.success) setWorkTypeSettings(res.data.data); }).catch(() => {}),
        ]).finally(() => setRefDataLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // Project is an optional pre-filter on the Work picker below, not a
    // prerequisite — this form could already tag a payment to a Work with
    // no Project field of its own (onSelectWork back-filled projectId from
    // the Work), so leaving it unset and picking a Work directly still
    // works exactly as before.
    const fetchProjects = () => {
        setProjectsLoading(true);
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {}).finally(() => setProjectsLoading(false));
    };
    useEffect(fetchProjects, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    // This picker has no ledger loaded (unlike ContractorLedgerView), so the
    // Work picker's options come from this contractor's own assignments
    // directly — same endpoint, now filterable by contractorVendorId. Not
    // additionally filtered by projectId server-side (that endpoint has no
    // such param) — the Project field above narrows this same list
    // client-side instead, just below.
    useEffect(() => {
        if (!vendorId) { setWorks([]); return; }
        setWorksLoading(true);
        axios.get(`${url}/api/finance/work-contractor-assignments/list`, { ...authHeader, params: { contractorVendorId: vendorId } })
            .then(res => { if (res.data.success) setWorks(res.data.data.filter(a => a.workId)); }).catch(() => {}).finally(() => setWorksLoading(false));
    }, [url, vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

    // This contractor's own works, narrowed to the selected project when
    // one's picked — same list either way, so choosing a Project can never
    // surface a Work that wasn't already a valid option.
    const worksForSelectedProject = form.projectId ? works.filter(a => a.workId?.projectId?._id === form.projectId) : works;

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/contractor-payments/list`, { ...authHeader, params: { vendorId } });
            if (res.data.success) setPayments(res.data.data);
        } catch { toast.error('Error fetching payments'); }
        finally { setLoading(false); }
    };

    // Balance Payable — same figure ContractorLedgerView.jsx already shows,
    // surfaced here too so it's visible right where you're about to record
    // a payment against it, not just on the separate Ledger tab. See
    // VendorPaymentsManager.jsx's identical fetchAmountOwed.
    const fetchBalancePayable = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/contractors/${vendorId}/ledger`, authHeader);
            if (res.data.success) setTotals(res.data.data.totals);
        } catch { setTotals(null); }
    };

    useEffect(() => {
        if (vendorId) { fetchPayments(); fetchBalancePayable(); } else { setPayments([]); setTotals(null); }
    }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment for this contractor recorded elsewhere (ContractorLedgerView,
    // or this same tab in another browser tab/admin) wouldn't otherwise show
    // up here until the contractor was reselected.
    useFinanceWsRefresh(['financeContractorLedgerChanged'], () => { if (vendorId) { fetchPayments(); fetchBalancePayable(); } });

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    // Changing Project after a Work was already picked would otherwise leave
    // a Work from the old project silently selected — clearing it (and the
    // TDS section/amount that Work resolved) forces a fresh pick under the
    // newly-selected project, same "changing the parent resets the child"
    // rule ExpensesManager's setProjectField already applies.
    const setProjectField = (value) => setForm(prev => ({ ...prev, projectId: value, workId: '', tdsSectionId: '', tdsAmount: '' }));

    // See ContractorLedgerView.jsx's identical handlers.
    const onSelectWork = (workId) => {
        const assignment = works.find(a => a.workId?._id === workId);
        const workType = workTypeSettings.find(t => t.name === assignment?.workId?.workType);
        const section = workType?.tdsSectionId || null;
        // Tag the payment with the Work's own project too — see
        // ContractorLedgerView.jsx's identical comment.
        setForm(p => ({
            ...p, workId, projectId: assignment?.workId?.projectId?._id || '',
            tdsSectionId: section?._id || '', tdsAmount: calcTds(section?.rate, p.amount),
        }));
    };
    const onChangeAmount = (amount) => {
        setForm(p => {
            const section = tdsSections.find(s => s._id === p.tdsSectionId);
            return {
                ...p, amount,
                tdsAmount: p.tdsSectionId ? calcTds(section?.rate, amount) : p.tdsAmount,
                holdingAmount: p.holdingPercent ? calcTds(p.holdingPercent, amount) : p.holdingAmount,
            };
        });
    };
    const onChangeTdsSection = (tdsSectionId) => {
        setForm(p => {
            const section = tdsSections.find(s => s._id === tdsSectionId);
            return { ...p, tdsSectionId, tdsAmount: tdsSectionId ? calcTds(section?.rate, p.amount) : '' };
        });
    };
    // calcTds is a plain rate% × amount formula — reused as-is for Holding.
    const onChangeHoldingPercent = (holdingPercent) => {
        setForm(p => ({ ...p, holdingPercent, holdingAmount: holdingPercent ? calcTds(holdingPercent, p.amount) : '' }));
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!vendorId) return toast.error('Select a contractor');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        // See financeContractorPayment.js's identical guard.
        if (Number(form.holdingAmount) > 0 && !form.projectId) return toast.error('A project is required when withholding a holding amount');

        setSaving(true);
        try {
            const data = new FormData();
            Object.entries(form).forEach(([k, v]) => data.append(k, v));
            data.append('vendorId', vendorId);
            if (file) data.append('attachment', file);
            const res = await axios.post(`${url}/api/finance/contractor-payments/add`, data, {
                headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) {
                if (form.paymentMode) await registerSettingIfNew(url, authHeader, 'payment_mode', form.paymentMode, paymentModes.map(m => ({ name: m })));
                toast.success(res.data.message); setForm(emptyForm); setFile(null); setModalOpen(false);
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
            const res = await axios.delete(`${url}/api/finance/contractor-payments/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchPayments(); await fetchBalancePayable(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing payment'); }
        finally { setDeleting(false); }
    };

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
                <p>Contractor</p>
                <QuickAddPicker url={url} resourceKey="vendors" value={vendorId} onChange={setVendorId}
                    filter={v => v.vendorType === 'labour_contractor'} presetValues={{ vendorType: 'labour_contractor' }} placeholder="Select contractor…" />
            </div>

            {!vendorId ? (
                <div className="admin-empty-state"><p>Select a contractor to record or view payments.</p></div>
            ) : (
                <>
                    <div className="pq-section-header" style={{ marginBottom: '8px' }}>
                        <h3 style={{ margin: 0 }}>Payments</h3>
                        <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Payment</button>
                    </div>
                    {balancePayable !== null && (
                        <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                            {balancePayable < 0 ? 'Total Extra Paid' : 'Balance Payable'}: <span style={{ fontWeight: 700, color: balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(balancePayable).toLocaleString('en-IN')}</span>
                            {balancePayable < 0 && ` (${extraPaidSub(totals)})`}
                        </p>
                    )}
                    {loading ? (
                        <div className="admin-empty-state"><p>Loading…</p></div>
                    ) : payments.length === 0 ? (
                        <div className="admin-empty-state"><p>No payments recorded yet.</p></div>
                    ) : (
                        <div className="dash-chart-card cpm-card">
                            <div className="cpm-row cpm-header">
                                <b className="cpm-date">Date</b>
                                <b className="cpm-amount">Amount</b>
                                <b className="cpm-mode">Mode</b>
                                <b className="cpm-account">Account</b>
                                <b className="cpm-tds">TDS</b>
                                <b className="cpm-held">Held</b>
                                <b className="cpm-attachment">Attachment</b>
                                <b className="cpm-action">Action</b>
                            </div>
                            {payments.map(p => (
                                <div key={p._id} className="cpm-row">
                                    <p className="cpm-date">{new Date(p.date).toLocaleDateString()}</p>
                                    <p className="cpm-amount"><span className="pq-group-label">Amount</span>₹{(p.amount - (p.holdingAmount || 0)).toLocaleString('en-IN')}</p>
                                    <p className="cpm-mode"><span className="pq-group-label">Mode</span>{p.paymentMode || '-'}</p>
                                    <p className="cpm-account"><span className="pq-group-label">Account</span>{p.bankAccountId?.accountName || 'Cash'}</p>
                                    <p className="cpm-tds"><span className="pq-group-label">TDS</span>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                                    <p className="cpm-held"><span className="pq-group-label">Held</span>{p.holdingAmount ? `₹${p.holdingAmount.toLocaleString('en-IN')}${p.holdingPercent ? ` (${p.holdingPercent}%)` : ''}` : '-'}</p>
                                    <p className="cpm-attachment"><span className="pq-group-label">Attachment</span>{p.attachmentUrl ? <ViewAttachmentLink url={p.attachmentUrl}>View</ViewAttachmentLink> : '-'}</p>
                                    <div className="cpm-action">
                                        <button type="button" className="pq-btn-ghost-danger" onClick={() => setConfirmItem(p)} title="Remove payment" aria-label="Remove payment">
                                            <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {modalOpen && ReactDOM.createPortal(
                        <div className="submit-loader-overlay cpm-overlay" style={{ zIndex: 99999 }}>
                            <div className="loader-modal-box edit-modal cpm-modal">
                                <div className="cpm-modal-header">
                                    <h2>Add Payment</h2>
                                    {balancePayable !== null && (
                                        <p className="admin-subtitle" style={{ margin: '4px 0 0' }}>
                                            {balancePayable < 0 ? 'Total Extra Paid' : 'Payment Left'}: <span style={{ fontWeight: 700, color: balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(balancePayable).toLocaleString('en-IN')}</span>
                                            {balancePayable < 0 && ` (${extraPaidSub(totals)})`}
                                        </p>
                                    )}
                                </div>
                                <div className="cpm-modal-body">
                                    <form id="cpm-form" onSubmit={submit}>
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
                                                <p>Project (optional — narrows Work below)</p>
                                                <StyledSelect
                                                    value={form.projectId} onChange={setProjectField} placeholder="Any project" loading={projectsLoading}
                                                    options={projects.map(p => ({ value: p._id, label: p.name }))}
                                                />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Work (optional — resolves TDS from its type)</p>
                                                <StyledSelect
                                                    value={form.workId} onChange={onSelectWork} placeholder="Not tied to a Work" loading={worksLoading}
                                                    options={worksForSelectedProject.map(a => ({ value: a.workId._id, label: `${a.workId.workType} — ${a.workId.projectId?.name || '—'}` }))}
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
                                                    value={form.tdsSectionId} onChange={onChangeTdsSection} placeholder="No TDS" loading={refDataLoading}
                                                    options={tdsSections.map(s => ({ value: s._id, label: `${s.name}${s.rate != null ? ` (${s.rate}%)` : ''}` }))}
                                                />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>TDS Amount</p>
                                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.tdsAmount} onChange={e => setField('tdsAmount', e.target.value)} />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Holding % (retained till project completes)</p>
                                                <input type="number" onWheel={e => e.target.blur()} min="0" max="100" step="any" value={form.holdingPercent} onChange={e => onChangeHoldingPercent(e.target.value)} />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Holding Amount</p>
                                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.holdingAmount} onChange={e => setField('holdingAmount', e.target.value)} />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>UTR / Reference Number</p>
                                                <input type="text" value={form.utrNumber} onChange={e => setField('utrNumber', e.target.value)} />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Attachment</p>
                                                <input type="file" onChange={e => setFile(e.target.files[0] || null)} />
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
                                        {Number(form.holdingAmount) > 0 && !form.projectId && (
                                            <p className="admin-subtitle" style={{ margin: '12px 0 0', color: '#c0392b' }}>A project is required when withholding a holding amount — pick one above or it will be rejected on save.</p>
                                        )}
                                        {form.amount > 0 && (
                                            <p className="admin-subtitle" style={{ margin: '12px 0 0' }}>
                                                {(form.tdsAmount > 0 || form.holdingAmount > 0) ? (
                                                    <>
                                                        Amount entered ₹{Number(form.amount).toLocaleString('en-IN')}
                                                        {form.tdsAmount > 0 && <> · TDS to withhold ₹{Number(form.tdsAmount).toLocaleString('en-IN')}</>}
                                                        {form.holdingAmount > 0 && <> · Holding ₹{Number(form.holdingAmount).toLocaleString('en-IN')}</>}
                                                        {' · '}<b>Actual amount to pay: ₹{(Number(form.amount) - Number(form.tdsAmount || 0) - Number(form.holdingAmount || 0)).toLocaleString('en-IN')}</b>
                                                    </>
                                                ) : (
                                                    <b>Actual amount to pay: ₹{Number(form.amount).toLocaleString('en-IN')}</b>
                                                )}
                                            </p>
                                        )}
                                    </form>
                                </div>
                                <div className="edit-modal-actions cpm-modal-footer">
                                    <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                                    <button type="submit" form="cpm-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
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

export default ContractorPaymentsManager;
