import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { KpiCard, KpiGrid, ChartCard, EmptyChart, ChartTooltip, CHART_COLORS, formatINR, buildBreakdownSub, extraPaidSub, materialCostPerSqftDisplay } from './DashboardWidgets';
import StyledSelect from './StyledSelect';
import DownloadButton from './DownloadButton';
import { useFileDownload } from '../../hooks/useFileDownload';
import StyledDatePicker from './StyledDatePicker';
import ViewAttachmentLink from './ViewAttachmentLink';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/dashboard.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

// Monthly advances/deductions/payments — derived from the ledger response
// already fetched here, no separate endpoint needed.
const buildMonthlyMoneyFlow = (advances, deductions, payments) => {
    const byMonth = new Map();
    const bump = (date, field, amount) => {
        const month = new Date(date).toISOString().slice(0, 7);
        if (!byMonth.has(month)) byMonth.set(month, { month, advances: 0, deductions: 0, payments: 0 });
        byMonth.get(month)[field] += amount;
    };
    advances.forEach(a => bump(a.date, 'advances', a.amount));
    deductions.forEach(d => bump(d.date, 'deductions', d.amount));
    payments.forEach(p => bump(p.date, 'payments', p.amount));
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
};

const emptyAdvanceForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '' };
const emptyDeductionForm = { areaSqft: '', reason: '', date: '', notes: '', workId: '' };
const emptyPaymentForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', workId: '', projectId: '', tdsSectionId: '', tdsAmount: '', holdingPercent: '', holdingAmount: '' };

// Section's `rate` (%) × amount, rounded — a Work Type's own tdsSectionId
// comes pre-populated with its rate (see financeSetting.js's populate), so
// no extra lookup is needed once a Work Type resolves one; the TDS Sections
// list itself covers a manual override to a different section.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const calcTds = (rate, amount) => (rate != null && amount ? round2((rate / 100) * Number(amount)) : '');

/*
 * The full contractor ledger — earnings breakdown, and add/list/remove for
 * advances, deductions, and payments, ending in the computed Balance
 * Payable. This is what the Contractors page's "Ledger" tab renders (a
 * separate "Settlements" tab used to render this same view — removed as a
 * duplicate) and what Payables' Contractor tab and Payments' Contractor
 * Payment tab pull their numbers/forms from.
 *
 * Everything here comes from one GET /api/finance/contractors/:vendorId/ledger
 * call — nothing is stored client-side beyond form state.
 */
const ContractorLedgerView = ({ url, vendorId, projectId, showWorks = true }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [ledger, setLedger] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [workTypeSettings, setWorkTypeSettings] = useState([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [billProjectId, setBillProjectId] = useState('');
    const { downloading: downloadingBill, progress: billProgress, run: runBillDownload } = useFileDownload(authHeader);

    const [advanceForm, setAdvanceForm] = useState(emptyAdvanceForm);
    const [deductionForm, setDeductionForm] = useState(emptyDeductionForm);
    const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
    const [paymentFile, setPaymentFile] = useState(null);
    const [saving, setSaving] = useState('');
    const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
    const [deductionModalOpen, setDeductionModalOpen] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(null); // { kind, id, label }
    const [deleting, setDeleting] = useState(false);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/contractors/${vendorId}/ledger`, { ...authHeader, params: projectId ? { projectId } : {} });
            if (res.data.success) setLedger(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching ledger'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (vendorId) fetchLedger(); }, [vendorId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment/advance/deduction recorded elsewhere for this same
    // contractor (the standalone Contractor Payment tab) wouldn't otherwise
    // show up here until the contractor was reselected. Also covers a
    // client direct payment (Payables → Client Direct Payments) tagged to
    // this contractor — it changes Payment Left/Balance Payable here too.
    useFinanceWsRefresh(['financeContractorLedgerChanged', 'clientDirectPaymentsChanged'], (msg) => {
        if (!vendorId) return;
        if (msg.type === 'clientDirectPaymentsChanged' && (msg.partyType !== 'contractor' || msg.partyId !== vendorId)) return;
        if (msg.type === 'financeContractorLedgerChanged' && msg.vendorId && msg.vendorId !== vendorId) return;
        fetchLedger();
    });
    useEffect(() => {
        Promise.all([
            axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
                .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
                .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {}),
            // Work Types carry their own tdsSectionId (populated with rate) —
            // resolved by matching a picked Work's `workType` string against
            // this list's `name`, same string-match convention every other
            // work-type lookup in this codebase already uses.
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'work_type' } })
                .then(res => { if (res.data.success) setWorkTypeSettings(res.data.data); }).catch(() => {}),
        ]).finally(() => setRefDataLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const submitAdvance = async (e) => {
        e.preventDefault();
        if (!advanceForm.amount || Number(advanceForm.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!advanceForm.date) return toast.error('Date is required');
        setSaving('advance');
        try {
            const res = await axios.post(`${url}/api/finance/contractor-advances/add`, { ...advanceForm, vendorId, projectId: projectId || null }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setAdvanceForm(emptyAdvanceForm); setAdvanceModalOpen(false); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording advance'); }
        finally { setSaving(''); }
    };

    const submitDeduction = async (e) => {
        e.preventDefault();
        if (!deductionForm.workId) return toast.error('Work is required: the deduction amount is derived from its rate');
        if (!deductionForm.areaSqft || Number(deductionForm.areaSqft) <= 0) return toast.error('Sqft to deduct must be greater than zero');
        if (!deductionForm.reason.trim()) return toast.error('Reason is required');
        if (!deductionForm.date) return toast.error('Date is required');
        setSaving('deduction');
        try {
            const res = await axios.post(`${url}/api/finance/contractor-deductions/add`, { ...deductionForm, vendorId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setDeductionForm(emptyDeductionForm); setDeductionModalOpen(false); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording deduction'); }
        finally { setSaving(''); }
    };

    // Selecting a Work resolves its workType against Work Type settings —
    // if that type has a tdsSectionId set, auto-suggest it and compute the
    // amount from its rate. Still fully overridable afterward (changing the
    // TDS Section or typing over the Amount just recalculates from there).
    const onSelectPaymentWork = (workId) => {
        const work = ledger.works.find(w => w._id === workId);
        const workType = workTypeSettings.find(t => t.name === work?.workType);
        const section = workType?.tdsSectionId || null;
        setPaymentForm(p => ({
            ...p, workId,
            // A Work always belongs to exactly one project — tag the
            // payment with it too (not just workId), so it isn't invisible
            // to every project-scoped view/statement that filters by
            // projectId (Payment Statement PDF, Project Overview) the same
            // way an untagged advance/deduction/payment already was before
            // last session's proportional-allocation fix.
            projectId: work?.projectId || '',
            tdsSectionId: section?._id || '',
            tdsAmount: calcTds(section?.rate, p.amount),
        }));
    };
    const onChangePaymentAmount = (amount) => {
        setPaymentForm(p => {
            const section = tdsSections.find(s => s._id === p.tdsSectionId);
            return {
                ...p, amount,
                tdsAmount: p.tdsSectionId ? calcTds(section?.rate, amount) : p.tdsAmount,
                // Holding has no Section/Work resolution (unlike TDS) — it's
                // just a manually-picked percent, but still recalculates off
                // a changed Amount the same way.
                holdingAmount: p.holdingPercent ? calcTds(p.holdingPercent, amount) : p.holdingAmount,
            };
        });
    };
    const onChangePaymentTdsSection = (tdsSectionId) => {
        setPaymentForm(p => {
            const section = tdsSections.find(s => s._id === tdsSectionId);
            return { ...p, tdsSectionId, tdsAmount: tdsSectionId ? calcTds(section?.rate, p.amount) : '' };
        });
    };
    // calcTds is a plain rate% × amount formula — reused as-is for Holding.
    const onChangePaymentHoldingPercent = (holdingPercent) => {
        setPaymentForm(p => ({ ...p, holdingPercent, holdingAmount: holdingPercent ? calcTds(holdingPercent, p.amount) : '' }));
    };

    const submitPayment = async (e) => {
        e.preventDefault();
        if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!paymentForm.date) return toast.error('Date is required');
        // See financeContractorPayment.js's identical guard — a holding
        // needs a project to release against once it completes.
        if (Number(paymentForm.holdingAmount) > 0 && !(projectId || paymentForm.projectId)) {
            return toast.error('A project is required when withholding a holding amount');
        }
        setSaving('payment');
        try {
            const data = new FormData();
            // This view's own `projectId` prop (set when embedded somewhere
            // already project-scoped) wins if present; otherwise fall back
            // to whatever the Work picker resolved above.
            Object.entries({ ...paymentForm, projectId: projectId || paymentForm.projectId || '' }).forEach(([k, v]) => data.append(k, v));
            data.append('vendorId', vendorId);
            if (paymentFile) data.append('attachment', paymentFile);
            const res = await axios.post(`${url}/api/finance/contractor-payments/add`, data, {
                headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) { toast.success(res.data.message); setPaymentForm(emptyPaymentForm); setPaymentFile(null); setPaymentModalOpen(false); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording payment'); }
        finally { setSaving(''); }
    };

    const billProjectOptions = useMemo(() => {
        if (!ledger) return [];
        const seen = new Map();
        for (const w of ledger.works) seen.set(w.projectId, w.projectName);
        return [...seen.entries()].map(([value, label]) => ({ value, label }));
    }, [ledger]);

    const confirmRemoveItem = async () => {
        if (!confirmRemove) return;
        const { kind, id } = confirmRemove;
        const endpoint = { advance: 'contractor-advances', deduction: 'contractor-deductions', payment: 'contractor-payments' }[kind];
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/${endpoint}/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmRemove(null); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch { toast.error(`Error removing ${kind}`); }
        finally { setDeleting(false); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!ledger) return <div className="admin-empty-state"><p>Unable to load ledger.</p></div>;

    const { totals } = ledger;
    const monthlyFlow = buildMonthlyMoneyFlow(ledger.advances, ledger.deductions, ledger.payments);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '16px' }}>
                <div className="add-product-name flex-col" style={{ minWidth: '220px' }}>
                    <p>Download Payment Statement For</p>
                    <StyledSelect
                        value={billProjectId} onChange={setBillProjectId} placeholder="Select project…" loading={loading}
                        options={billProjectOptions}
                    />
                </div>
                <DownloadButton
                    downloading={downloadingBill} progress={billProgress}
                    idleLabel="Download Statement" className="add-btn"
                    onClick={() => billProjectId && runBillDownload(
                        url, `/api/finance/contractors/${vendorId}/ledger/download`,
                        `Contractor-Statement-${ledger.vendorName}-${billProjectOptions.find(o => o.value === billProjectId)?.label}.pdf`,
                        { projectId: billProjectId }, 'Error downloading statement'
                    )}
                    style={billProjectId ? undefined : { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' }}
                />
            </div>

            <KpiGrid>
                <KpiCard label="Total (All Logged)" value={formatINR(totals.totalAmount)} />
                <KpiCard label="Approved (Reviewed)" value={totals.earnings > 0 ? formatINR(totals.earnings) : 'Unapproved'} tone={totals.earnings > 0 ? 'good' : undefined} />
                <KpiCard label="Unapproved" value={formatINR(totals.unapprovedAmount)} tone={totals.unapprovedAmount > 0 ? 'danger' : undefined} />
                <KpiCard label="Advances" value={formatINR(totals.advances)} />
                <KpiCard label="Deductions" value={formatINR(totals.deductions)} />
                {totals.materialWasteTotal > 0 && <KpiCard label="Material Waste" value={formatINR(totals.materialWasteTotal)} />}
                <KpiCard label="Direct Payments" value={formatINR(totals.directPaymentTotal)} />
                <KpiCard label="Payments" value={formatINR(totals.payments)}
                    sub={(totals.tdsTotal > 0 || totals.holdingTotal > 0)
                        ? `Cash to contractor ${formatINR(totals.payments - (totals.tdsTotal || 0) - (totals.holdingTotal || 0))}`
                            + (totals.tdsTotal > 0 ? `  TDS withheld ${formatINR(totals.tdsTotal)}` : '')
                            + (totals.holdingTotal > 0 ? `  Holding ${formatINR(totals.holdingTotal)}` : '')
                        : undefined} />
                <KpiCard label={totals.balancePayable < 0 ? 'Total Extra Paid' : 'Balance Payable'} value={formatINR(Math.abs(totals.balancePayable))}
                    sub={totals.balancePayable < 0 ? extraPaidSub(totals) : buildBreakdownSub([
                        ['Earned', totals.earnings],
                        ['Advances', totals.advances, true],
                        ['Deductions', totals.deductions, true],
                        ['Material Waste', totals.materialWasteTotal, true],
                        ['Direct Pay', totals.directPaymentTotal, true],
                        // Net of Holding — a held amount hasn't actually left
                        // the company (unlike TDS), so it stays owed; see
                        // financeContractorLedger.js's balancePayable comment.
                        ['Paid', round2(totals.payments - (totals.holdingTotal || 0)), true],
                    ])}
                    tone={totals.balancePayable > 0 ? 'danger' : 'good'} />
            </KpiGrid>
            {totals.unapprovedAmount > 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                    ₹{totals.unapprovedAmount.toLocaleString('en-IN')} worth of measured work hasn't been reviewed yet (or is still awaiting rejected-sqft attribution); it isn't counted as Approved earnings until that's resolved (Payables/Receivables → Deductions).
                </p>
            )}
            {totals.materialWasteTotal > 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                    ₹{totals.materialWasteTotal.toLocaleString('en-IN')} is the material this contractor's own rejected work wasted (priced at their own material-cost-per-sqft) — a separate, additional deduction from Deductions above, already subtracted from Balance Payable.
                </p>
            )}
            {totals.directPaymentTotal > 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                    ₹{totals.directPaymentTotal.toLocaleString('en-IN')} paid directly by the client to this contractor (an advance, not tied to specific sqft) — already subtracted from Balance Payable above.
                </p>
            )}
            {totals.balancePayable < 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                    Paid more than currently-approved work earns — some already-paid work is still pending review, not a balance owed back.
                </p>
            )}
            {totals.tdsTotal > 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                    Total Paid: ₹{totals.payments.toLocaleString('en-IN')} (of which ₹{totals.tdsTotal.toLocaleString('en-IN')} was TDS withheld, not cash in hand).
                </p>
            )}
            {totals.holdingTotal > 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                    ₹{totals.holdingTotal.toLocaleString('en-IN')} of Total Paid was retained as Holding, not paid out — unlike TDS, this stays owed (already reflected in Balance Payable above) until released as a future payment once the project completes.
                </p>
            )}

            <div style={{ marginBottom: '28px', marginTop: '20px' }}>
                <ChartCard title="Advances / Deductions / Payments, by month">
                    {monthlyFlow.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={monthlyFlow}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="advances" name="Advances" fill={CHART_COLORS[1]} activeBar={false} />
                                <Bar dataKey="deductions" name="Deductions" fill={CHART_COLORS[2]} activeBar={false} />
                                <Bar dataKey="payments" name="Payments" fill={CHART_COLORS[0]} activeBar={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart text="No advances, deductions, or payments yet." />}
                </ChartCard>
            </div>

            {showWorks && (
                <>
                    <h3 style={{ marginBottom: '8px' }}>Works & Earnings</h3>
                    {ledger.works.length === 0 ? (
                        <div className="admin-empty-state" style={{ marginBottom: '28px' }}><p>No works for this contractor yet.</p></div>
                    ) : (
                        <div className="dash-chart-card cle-work-card" style={{ marginBottom: '28px' }}>
                            <div className="cle-work-row cle-work-header">
                                <b className="cle-work-project">Project</b>
                                <b className="cle-work-type">Work Type</b>
                                <b className="cle-work-area">Area Done</b>
                                <b className="cle-work-total">Total</b>
                                <b className="cle-work-approved">Approved (as of)</b>
                                <b className="cle-work-unapproved">Unapproved</b>
                                <b className="cle-work-cost">Material Cost/Sqft</b>
                            </div>
                            {ledger.works.map(w => (
                                <div key={w._id} className="cle-work-row">
                                    <p className="cle-work-project">{w.projectName}</p>
                                    <p className="cle-work-type"><span className="pq-group-label">Work Type</span>{w.workType}</p>
                                    {/* This contractor's own logged area on this Work — not
                                        w.estimatedAreaSqft, which is the whole Work's target,
                                        not this contractor's share of it. */}
                                    <p className="cle-work-area"><span className="pq-group-label">Area Done</span>{w.completedAreaSqft} sqft</p>
                                    <p className="cle-work-total"><span className="pq-group-label">Total</span>{w.rate ? `₹${w.totalAmount.toLocaleString('en-IN')}` : <span title="No matching contractor rate configured">(no rate)</span>}</p>
                                    <p className="cle-work-approved" style={{ color: w.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}>
                                        <span className="pq-group-label">Approved (as of)</span>
                                        {w.earnings > 0
                                            ? <>₹{w.earnings.toLocaleString('en-IN')} <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>({w.approvedAreaSqft} sqft{w.approvedDate ? `, ${new Date(w.approvedDate).toLocaleDateString()}` : ''})</span></>
                                            : 'Unapproved'}
                                    </p>
                                    <p className="cle-work-unapproved" style={{ color: w.unapprovedAmount > 0 ? '#c0392b' : 'var(--text-lt)' }}>
                                        <span className="pq-group-label">Unapproved</span>
                                        {w.rate ? `₹${w.unapprovedAmount.toLocaleString('en-IN')}` : '-'}
                                    </p>
                                    <p className="cle-work-cost"><span className="pq-group-label">Material Cost/Sqft</span>{materialCostPerSqftDisplay(w.materialCostPerSqftApproved, w.materialCostPerSqftUnapproved)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            <div className="pq-section-header">
                <h3 style={{ margin: 0 }}>Advances</h3>
                <button type="button" className="add-btn" onClick={() => setAdvanceModalOpen(true)}>+ Add Advance</button>
            </div>
            {ledger.advances.length === 0 ? (
                <div className="admin-empty-state"><p>No advances yet.</p></div>
            ) : (
                <div className="dash-chart-card cla-card" style={{ marginBottom: '28px' }}>
                    <div className="cla-row cla-header">
                        <b className="cla-date">Date</b>
                        <b className="cla-amount">Amount</b>
                        <b className="cla-mode">Mode</b>
                        <b className="cla-account">Account</b>
                        <b className="cla-notes">Notes</b>
                        <b className="cla-actions">Action</b>
                    </div>
                    {ledger.advances.map(a => (
                        <div key={a._id} className="cla-row">
                            <p className="cla-date"><span className="pq-group-label">Date</span>{new Date(a.date).toLocaleDateString()}</p>
                            <p className="cla-amount"><span className="pq-group-label">Amount</span>₹{a.amount.toLocaleString('en-IN')}</p>
                            <p className="cla-mode"><span className="pq-group-label">Mode</span>{a.paymentMode || '-'}</p>
                            <p className="cla-account"><span className="pq-group-label">Account</span>{a.bankAccountId?.accountName || 'Cash'}</p>
                            <p className="cla-notes"><span className="pq-group-label">Notes</span>{a.notes || '-'}</p>
                            <div className="action-buttons cla-actions">
                                <button type="button" onClick={() => setConfirmRemove({ kind: 'advance', id: a._id, label: `₹${a.amount.toLocaleString('en-IN')} advance` })} className="pq-btn-ghost-danger" title="Remove advance" aria-label="Remove advance">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {advanceModalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay cla-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal cla-modal">
                        <div className="cla-modal-header">
                            <h2>Add Advance</h2>
                            <p className="admin-subtitle" style={{ margin: 0 }}>
                                Current {totals.balancePayable < 0 ? 'Total Extra Paid' : 'Balance Payable'}: <span style={{ fontWeight: 700, color: totals.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(totals.balancePayable).toLocaleString('en-IN')}</span>
                                {totals.balancePayable < 0 && ` (${extraPaidSub(totals)})`}
                            </p>
                        </div>
                        <div className="cla-modal-body">
                        <form id="contractor-advance-form" onSubmit={submitAdvance}>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Amount (₹) *</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={advanceForm.amount} onChange={e => setAdvanceForm(p => ({ ...p, amount: e.target.value }))} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Date *</p>
                                    <StyledDatePicker value={advanceForm.date} onChange={v => setAdvanceForm(p => ({ ...p, date: v }))} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Payment Mode</p>
                                    <input type="text" value={advanceForm.paymentMode} onChange={e => setAdvanceForm(p => ({ ...p, paymentMode: e.target.value }))} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Bank Account</p>
                                    <StyledSelect
                                        value={advanceForm.bankAccountId} onChange={v => setAdvanceForm(p => ({ ...p, bankAccountId: v }))} placeholder="Cash" loading={refDataLoading}
                                        options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                                    />
                                </div>
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Notes</p>
                                    <input type="text" value={advanceForm.notes} onChange={e => setAdvanceForm(p => ({ ...p, notes: e.target.value }))} />
                                </div>
                            </div>
                        </form>
                        </div>
                        <div className="edit-modal-actions cla-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setAdvanceModalOpen(false)}>Cancel</button>
                            <button type="submit" form="contractor-advance-form" className="add-btn" disabled={saving === 'advance'}>{saving === 'advance' ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="pq-section-header">
                <h3 style={{ margin: 0 }}>Deductions</h3>
                {!(showWorks && ledger.works.length === 0) && (
                    <button type="button" className="add-btn" onClick={() => setDeductionModalOpen(true)}>+ Add Deduction</button>
                )}
            </div>
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>
                Sqft in, ₹ out: the amount is always derived from the picked work's rate, never typed directly.
                {ledger.deductions.some(d => d.workReviewCycle != null) && (
                    <> Rows labeled <b>From Review</b> came from a Work Review's rejection distribution — their <b>Amount</b> is already reflected in Approved Earnings above, so it isn't counted again in the Deductions total below (only <b>Manual</b> rows' Amount is). Their <b>Material Waste</b>, if any, is different — always an additional, real deduction on top.</>
                )}
            </p>
            {showWorks && ledger.works.length === 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '20px' }}>No works for this contractor yet; a deduction needs a work to derive its rate from.</p>
            )}
            {ledger.deductions.length === 0 ? (
                <div className="admin-empty-state"><p>No deductions yet.</p></div>
            ) : (
                <div className="dash-chart-card cld-card" style={{ marginBottom: '28px' }}>
                    <div className="cld-row cld-header">
                        <b className="cld-date">Date</b>
                        <b className="cld-sqft">Sqft</b>
                        <b className="cld-amount">Amount</b>
                        <b className="cld-waste">Material Waste</b>
                        <b className="cld-source">Source</b>
                        <b className="cld-reason">Reason</b>
                        <b className="cld-work">Work</b>
                        <b className="cld-actions">Action</b>
                    </div>
                    {ledger.deductions.map(d => (
                        <div key={d._id} className="cld-row">
                            <p className="cld-date"><span className="pq-group-label">Date</span>{new Date(d.date).toLocaleDateString()}</p>
                            <p className="cld-sqft"><span className="pq-group-label">Sqft</span>{d.areaSqft ?? '-'}</p>
                            <p className="cld-amount"><span className="pq-group-label">Amount</span>₹{d.amount.toLocaleString('en-IN')}</p>
                            <p className="cld-waste"><span className="pq-group-label">Material Waste</span>{d.materialWasteAmount > 0 ? `₹${d.materialWasteAmount.toLocaleString('en-IN')}` : '-'}</p>
                            <p className="cld-source" style={{ color: d.workReviewCycle != null ? 'var(--text-lt)' : 'inherit', fontWeight: d.workReviewCycle == null ? 600 : 400 }}>
                                <span className="pq-group-label">Source</span>
                                {d.workReviewCycle != null ? 'From Review' : 'Manual'}
                            </p>
                            <p className="cld-reason"><span className="pq-group-label">Reason</span>{d.reason}</p>
                            <p className="cld-work"><span className="pq-group-label">Work</span>{ledger.works.find(w => w._id === (d.workId?._id || d.workId))?.workType || '-'}</p>
                            <div className="action-buttons cld-actions">
                                {d.workReviewCycle != null
                                    ? <p title="Change this by redoing the Work Review, not by deleting it here" style={{ color: 'var(--text-lt)', fontSize: '0.85em', margin: 0 }}>—</p>
                                    : <button type="button" onClick={() => setConfirmRemove({ kind: 'deduction', id: d._id, label: `${d.reason} deduction` })} className="pq-btn-ghost-danger" title="Remove deduction" aria-label="Remove deduction">
                                        <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                    </button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {deductionModalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay cld-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal cld-modal">
                        <div className="cld-modal-header">
                            <h2>Add Deduction</h2>
                        </div>
                        <div className="cld-modal-body">
                        <form id="contractor-deduction-form" onSubmit={submitDeduction}>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Work *</p>
                                    <select value={deductionForm.workId} onChange={e => setDeductionForm(p => ({ ...p, workId: e.target.value }))}>
                                        <option value="">Select work…</option>
                                        {ledger.works.map(w => <option key={w._id} value={w._id}>{w.projectName} · {w.workType}</option>)}
                                    </select>
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Sqft to Deduct *</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={deductionForm.areaSqft} onChange={e => setDeductionForm(p => ({ ...p, areaSqft: e.target.value }))} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Reason *</p>
                                    <input type="text" value={deductionForm.reason} onChange={e => setDeductionForm(p => ({ ...p, reason: e.target.value }))} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Date *</p>
                                    <StyledDatePicker value={deductionForm.date} onChange={v => setDeductionForm(p => ({ ...p, date: v }))} />
                                </div>
                            </div>
                            {deductionForm.workId && deductionForm.areaSqft > 0 && (() => {
                                const rate = ledger.works.find(w => w._id === deductionForm.workId)?.rate;
                                return rate
                                    ? <p className="admin-subtitle" style={{ marginTop: '8px' }}>≈ ₹{(rate * Number(deductionForm.areaSqft)).toLocaleString('en-IN')} at ₹{rate}/sqft</p>
                                    : <p className="admin-subtitle" style={{ marginTop: '8px', color: '#c0392b' }}>No rate configured for this work; deduction will be rejected.</p>;
                            })()}
                        </form>
                        </div>
                        <div className="edit-modal-actions cld-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setDeductionModalOpen(false)}>Cancel</button>
                            <button type="submit" form="contractor-deduction-form" className="add-btn" disabled={saving === 'deduction'}>{saving === 'deduction' ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="pq-section-header">
                <h3 style={{ margin: 0 }}>Payments</h3>
                <button type="button" className="add-btn" onClick={() => setPaymentModalOpen(true)}>+ Add Payment</button>
            </div>
            {ledger.payments.length === 0 ? (
                <div className="admin-empty-state"><p>No payments yet.</p></div>
            ) : (
                <div className="dash-chart-card clp-card">
                    <div className="clp-row clp-header">
                        <b className="clp-date">Date</b>
                        <b className="clp-amount">Amount</b>
                        <b className="clp-mode">Mode</b>
                        <b className="clp-account">Account</b>
                        <b className="clp-tds">TDS</b>
                        <b className="clp-held">Held</b>
                        <b className="clp-attachment">Attachment</b>
                        <b className="clp-actions">Action</b>
                    </div>
                    {ledger.payments.map(p => (
                        <div key={p._id} className="clp-row">
                            <p className="clp-date"><span className="pq-group-label">Date</span>{new Date(p.date).toLocaleDateString()}</p>
                            {/* Net of Holding — see financeContractorLedger.js's PDF Payments
                                table for the identical convention/reasoning. */}
                            <p className="clp-amount"><span className="pq-group-label">Amount</span>₹{(p.amount - (p.holdingAmount || 0)).toLocaleString('en-IN')}</p>
                            <p className="clp-mode"><span className="pq-group-label">Mode</span>{p.paymentMode || '-'}</p>
                            <p className="clp-account"><span className="pq-group-label">Account</span>{p.bankAccountId?.accountName || 'Cash'}</p>
                            <p className="clp-tds"><span className="pq-group-label">TDS</span>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                            <p className="clp-held"><span className="pq-group-label">Held</span>{p.holdingAmount ? `₹${p.holdingAmount.toLocaleString('en-IN')}${p.holdingPercent ? ` (${p.holdingPercent}%)` : ''}` : '-'}</p>
                            <div className="clp-attachment">
                                <span className="pq-group-label">Attachment</span>
                                {p.attachmentUrl ? <ViewAttachmentLink url={p.attachmentUrl} className="cursor edit-action" style={{ textDecoration: 'none' }}>View</ViewAttachmentLink> : <p style={{ margin: 0 }}>-</p>}
                            </div>
                            <div className="action-buttons clp-actions">
                                <button type="button" onClick={() => setConfirmRemove({ kind: 'payment', id: p._id, label: `₹${p.amount.toLocaleString('en-IN')} payment` })} className="pq-btn-ghost-danger" title="Remove payment" aria-label="Remove payment">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {paymentModalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay clp-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal clp-modal">
                        <div className="clp-modal-header">
                            <h2>Add Payment</h2>
                            <p className="admin-subtitle" style={{ margin: 0 }}>
                                {totals.balancePayable < 0 ? 'Total Extra Paid' : 'Payment Left'}: <span style={{ fontWeight: 700, color: totals.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(totals.balancePayable).toLocaleString('en-IN')}</span>
                                {totals.balancePayable < 0 && ` (${extraPaidSub(totals)})`}
                            </p>
                        </div>
                        <div className="clp-modal-body">
                        <form id="contractor-payment-form" onSubmit={submitPayment}>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Amount (₹) *</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={paymentForm.amount} onChange={e => onChangePaymentAmount(e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Date *</p>
                                    <StyledDatePicker value={paymentForm.date} onChange={v => setPaymentForm(p => ({ ...p, date: v }))} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Work (optional — resolves TDS from its type)</p>
                                    <StyledSelect
                                        value={paymentForm.workId} onChange={onSelectPaymentWork} placeholder="Not tied to a Work" loading={loading}
                                        options={ledger.works.map(w => ({ value: w._id, label: `${w.workType} — ${w.projectName}` }))}
                                    />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Payment Mode</p>
                                    <input type="text" value={paymentForm.paymentMode} onChange={e => setPaymentForm(p => ({ ...p, paymentMode: e.target.value }))} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Bank Account</p>
                                    <StyledSelect
                                        value={paymentForm.bankAccountId} onChange={v => setPaymentForm(p => ({ ...p, bankAccountId: v }))} placeholder="Cash" loading={refDataLoading}
                                        options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                                    />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>TDS Section</p>
                                    <StyledSelect
                                        value={paymentForm.tdsSectionId} onChange={onChangePaymentTdsSection} placeholder="No TDS" loading={refDataLoading}
                                        options={tdsSections.map(s => ({ value: s._id, label: `${s.name}${s.rate != null ? ` (${s.rate}%)` : ''}` }))}
                                    />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>TDS Amount</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={paymentForm.tdsAmount} onChange={e => setPaymentForm(p => ({ ...p, tdsAmount: e.target.value }))} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Holding % (retained till project completes)</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" max="100" step="any" value={paymentForm.holdingPercent} onChange={e => onChangePaymentHoldingPercent(e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Holding Amount</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={paymentForm.holdingAmount} onChange={e => setPaymentForm(p => ({ ...p, holdingAmount: e.target.value }))} />
                                </div>
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Attachment</p>
                                    <input type="file" onChange={e => setPaymentFile(e.target.files[0] || null)} />
                                </div>
                            </div>
                            {Number(paymentForm.holdingAmount) > 0 && !(projectId || paymentForm.projectId) && (
                                <p className="admin-subtitle" style={{ margin: '-8px 0 12px', color: '#c0392b' }}>A project is required when withholding a holding amount — pick a Work above or it will be rejected on save.</p>
                            )}
                            {paymentForm.amount > 0 && (
                                <p className="admin-subtitle" style={{ margin: '-8px 0 12px' }}>
                                    {(paymentForm.tdsAmount > 0 || paymentForm.holdingAmount > 0) ? (
                                        <>
                                            Amount entered ₹{Number(paymentForm.amount).toLocaleString('en-IN')}
                                            {paymentForm.tdsAmount > 0 && <> · TDS to withhold ₹{Number(paymentForm.tdsAmount).toLocaleString('en-IN')}</>}
                                            {paymentForm.holdingAmount > 0 && <> · Holding ₹{Number(paymentForm.holdingAmount).toLocaleString('en-IN')}</>}
                                            {' · '}<b>Actual amount to pay: ₹{(Number(paymentForm.amount) - Number(paymentForm.tdsAmount || 0) - Number(paymentForm.holdingAmount || 0)).toLocaleString('en-IN')}</b>
                                        </>
                                    ) : (
                                        <b>Actual amount to pay: ₹{Number(paymentForm.amount).toLocaleString('en-IN')}</b>
                                    )}
                                </p>
                            )}
                        </form>
                        </div>
                        <div className="edit-modal-actions clp-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setPaymentModalOpen(false)}>Cancel</button>
                            <button type="submit" form="contractor-payment-form" className="add-btn" disabled={saving === 'payment'}>{saving === 'payment' ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmRemove && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmRemove(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this {confirmRemove.kind}?</h3>
                        <p className="bin-confirm-name">{confirmRemove.label}</p>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmRemove(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmRemoveItem} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ContractorLedgerView;
