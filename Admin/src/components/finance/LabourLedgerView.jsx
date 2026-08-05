import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { KpiCard, KpiGrid, ChartCard, EmptyChart, ChartTooltip, CHART_COLORS, formatINR, buildBreakdownSub, extraPaidSub } from './DashboardWidgets';
import StyledSelect from './StyledSelect';
import DownloadButton from './DownloadButton';
import { useFileDownload } from '../../hooks/useFileDownload';
import StyledDatePicker from './StyledDatePicker';
import SettingSelectField, { registerSettingIfNew } from './SettingSelectField';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/dashboard.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

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

const emptyAdvanceForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', notes: '' };
const emptyDeductionForm = { areaSqft: '', reason: '', date: '', source: 'engineer_review', supervisorId: '', notes: '', workId: '' };
const emptyPaymentForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', notes: '', workId: '', projectId: '', tdsSectionId: '', tdsAmount: '' };

// See ContractorLedgerView.jsx's identical helper.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const calcTds = (rate, amount) => (rate != null && amount ? round2((rate / 100) * Number(amount)) : '');

/*
 * The full labour ledger — earnings, and add/list/remove for advances,
 * deductions, and payments, ending in the computed Balance Payable.
 * Mirrors ContractorLedgerView; the one real difference is the Deduction
 * form, which carries a `source` (did the supervisor catch it on the
 * spot, or did the engineer flag it at periodic review) and — only for
 * a supervisor catch — a Supervisor picker, since that path also credits
 * the supervisor an incentive for the same amount (done server-side, in
 * one request).
 */
const LabourLedgerView = ({ url, labourerId, projectId, showWorks = true }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [ledger, setLedger] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [workTypeSettings, setWorkTypeSettings] = useState([]);
    const [paymentModes, setPaymentModes] = useState([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [billProjectId, setBillProjectId] = useState('');
    const { downloading: downloadingBill, progress: billProgress, run: runBillDownload } = useFileDownload(authHeader);

    const [advanceForm, setAdvanceForm] = useState(emptyAdvanceForm);
    const [deductionForm, setDeductionForm] = useState(emptyDeductionForm);
    const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
    const [saving, setSaving] = useState('');
    const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
    const [deductionModalOpen, setDeductionModalOpen] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(null); // { kind, id, label }
    const [deleting, setDeleting] = useState(false);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/labourer-ledger/${labourerId}/ledger`, { ...authHeader, params: projectId ? { projectId } : {} });
            if (res.data.success) setLedger(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching ledger'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (labourerId) fetchLedger(); }, [labourerId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment for this labourer recorded elsewhere (another browser
    // tab/admin viewing the same labourer) wouldn't otherwise show up here
    // until reselected.
    useFinanceWsRefresh(['financeLabourLedgerChanged', 'clientDirectPaymentsChanged'], (msg) => {
        if (!labourerId) return;
        if (msg.type === 'clientDirectPaymentsChanged' && (msg.partyType !== 'labour' || msg.partyId !== labourerId)) return;
        if (msg.type === 'financeLabourLedgerChanged' && msg.labourerId && msg.labourerId !== labourerId) return;
        fetchLedger();
    });
    useEffect(() => {
        Promise.all([
            axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
                .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/employees/list`, authHeader)
                .then(res => { if (res.data.success) setSupervisors(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
                .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'work_type' } })
                .then(res => { if (res.data.success) setWorkTypeSettings(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'payment_mode' } })
                .then(res => { if (res.data.success) setPaymentModes(res.data.data.map(s => s.name)); }).catch(() => {}),
        ]).finally(() => setRefDataLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const submitAdvance = async (e) => {
        e.preventDefault();
        if (!advanceForm.amount || Number(advanceForm.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!advanceForm.date) return toast.error('Date is required');
        setSaving('advance');
        try {
            const res = await axios.post(`${url}/api/finance/labour-advances/add`, { ...advanceForm, labourerId, projectId: projectId || null }, authHeader);
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
        if (deductionForm.source === 'supervisor_catch' && !deductionForm.supervisorId) return toast.error('Supervisor is required when they caught the mistake');
        setSaving('deduction');
        try {
            const res = await axios.post(`${url}/api/finance/labour-deductions/add`, { ...deductionForm, labourerId }, authHeader);
            if (res.data.success) {
                toast.success(deductionForm.source === 'supervisor_catch' ? 'Deduction recorded, supervisor credited' : res.data.message);
                setDeductionForm(emptyDeductionForm); setDeductionModalOpen(false); await fetchLedger();
            } else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording deduction'); }
        finally { setSaving(''); }
    };

    const submitPayment = async (e) => {
        e.preventDefault();
        if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!paymentForm.date) return toast.error('Date is required');
        setSaving('payment');
        try {
            // This view's own `projectId` prop (set when embedded somewhere
            // already project-scoped) wins if present; otherwise fall back
            // to whatever the Work picker resolved.
            const res = await axios.post(`${url}/api/finance/labour-payments/add`, { ...paymentForm, labourerId, projectId: projectId || paymentForm.projectId || null }, authHeader);
            if (res.data.success) {
                if (paymentForm.paymentMode) await registerSettingIfNew(url, authHeader, 'payment_mode', paymentForm.paymentMode, paymentModes.map(m => ({ name: m })));
                toast.success(res.data.message); setPaymentForm(emptyPaymentForm); setPaymentModalOpen(false); await fetchLedger();
            }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording payment'); }
        finally { setSaving(''); }
    };

    // See ContractorLedgerView.jsx's identical handlers.
    const onSelectPaymentWork = (workId) => {
        const work = ledger.works.find(w => w._id === workId);
        const workType = workTypeSettings.find(t => t.name === work?.workType);
        const section = workType?.tdsSectionId || null;
        setPaymentForm(p => ({
            ...p, workId,
            projectId: work?.projectId || '',
            tdsSectionId: section?._id || '',
            tdsAmount: calcTds(section?.rate, p.amount),
        }));
    };
    const onChangePaymentAmount = (amount) => {
        setPaymentForm(p => {
            const section = tdsSections.find(s => s._id === p.tdsSectionId);
            return { ...p, amount, tdsAmount: p.tdsSectionId ? calcTds(section?.rate, amount) : p.tdsAmount };
        });
    };
    const onChangePaymentTdsSection = (tdsSectionId) => {
        setPaymentForm(p => {
            const section = tdsSections.find(s => s._id === tdsSectionId);
            return { ...p, tdsSectionId, tdsAmount: tdsSectionId ? calcTds(section?.rate, p.amount) : '' };
        });
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
        const endpoint = { advance: 'labour-advances', deduction: 'labour-deductions', payment: 'labour-payments' }[kind];
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
                        url, `/api/finance/labourer-ledger/${labourerId}/ledger/download`,
                        `Labour-Statement-${ledger.labourerName}-${billProjectOptions.find(o => o.value === billProjectId)?.label}.pdf`,
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
                    sub={totals.tdsTotal > 0 ? `Cash to labourer ${formatINR(totals.payments - totals.tdsTotal)}  TDS withheld ${formatINR(totals.tdsTotal)}` : undefined} />
                <KpiCard label={totals.balancePayable < 0 ? 'Total Extra Paid' : 'Balance Payable'} value={formatINR(Math.abs(totals.balancePayable))}
                    sub={totals.balancePayable < 0 ? extraPaidSub(totals) : buildBreakdownSub([
                        ['Earned', totals.earnings],
                        ['Advances', totals.advances, true],
                        ['Deductions', totals.deductions, true],
                        ['Material Waste', totals.materialWasteTotal, true],
                        ['Direct Pay', totals.directPaymentTotal, true],
                        ['Paid', totals.payments, true],
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
                    ₹{totals.materialWasteTotal.toLocaleString('en-IN')} is the material this labourer's own rejected work wasted (priced at their own material-cost-per-sqft) — a separate, additional deduction from Deductions above, already subtracted from Balance Payable.
                </p>
            )}
            {totals.directPaymentTotal > 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                    ₹{totals.directPaymentTotal.toLocaleString('en-IN')} paid directly by the client to this labourer (an advance, not tied to specific sqft) — already subtracted from Balance Payable above.
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
                        <div className="admin-empty-state" style={{ marginBottom: '28px' }}><p>No works for this labourer yet.</p></div>
                    ) : (
                        <div className="dash-chart-card lle-work-card" style={{ marginBottom: '28px' }}>
                            <div className="lle-work-row lle-work-header">
                                <b className="lle-work-project">Project</b>
                                <b className="lle-work-type">Work Type</b>
                                <b className="lle-work-area">Area Done</b>
                                <b className="lle-work-total">Total</b>
                                <b className="lle-work-approved">Approved (as of)</b>
                                <b className="lle-work-unapproved">Unapproved</b>
                                <b className="lle-work-cost">Material Cost/Sqft</b>
                            </div>
                            {ledger.works.map(w => (
                                <div key={w._id} className="lle-work-row">
                                    <p className="lle-work-project">{w.projectName}</p>
                                    <p className="lle-work-type"><span className="pq-group-label">Work Type</span>{w.workType}</p>
                                    {/* This labourer's own logged area on this Work — not
                                        w.estimatedAreaSqft, which is the whole Work's target,
                                        not this labourer's share of it. */}
                                    <p className="lle-work-area"><span className="pq-group-label">Area Done</span>{w.completedAreaSqft} sqft</p>
                                    <p className="lle-work-total"><span className="pq-group-label">Total</span>{w.rate ? `₹${w.totalAmount.toLocaleString('en-IN')}` : <span title="No matching labour rate configured">(no rate)</span>}</p>
                                    <p className="lle-work-approved" style={{ color: w.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}>
                                        <span className="pq-group-label">Approved (as of)</span>
                                        {w.earnings > 0
                                            ? <>₹{w.earnings.toLocaleString('en-IN')} <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>({w.approvedAreaSqft} sqft{w.approvedDate ? `, ${new Date(w.approvedDate).toLocaleDateString()}` : ''})</span></>
                                            : 'Unapproved'}
                                    </p>
                                    <p className="lle-work-unapproved" style={{ color: w.unapprovedAmount > 0 ? '#c0392b' : 'var(--text-lt)' }}>
                                        <span className="pq-group-label">Unapproved</span>
                                        {w.rate ? `₹${w.unapprovedAmount.toLocaleString('en-IN')}` : '-'}
                                    </p>
                                    <p className="lle-work-cost"><span className="pq-group-label">Material Cost/Sqft</span>{w.materialCostPerSqft != null ? `₹${w.materialCostPerSqft.toFixed(2)}` : '—'}</p>
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
                <div className="dash-chart-card lla-card" style={{ marginBottom: '28px' }}>
                    <div className="lla-row lla-header">
                        <b className="lla-date">Date</b>
                        <b className="lla-amount">Amount</b>
                        <b className="lla-mode">Mode</b>
                        <b className="lla-account">Account</b>
                        <b className="lla-notes">Notes</b>
                        <b className="lla-actions">Action</b>
                    </div>
                    {ledger.advances.map(a => (
                        <div key={a._id} className="lla-row">
                            <p className="lla-date"><span className="pq-group-label">Date</span>{new Date(a.date).toLocaleDateString()}</p>
                            <p className="lla-amount"><span className="pq-group-label">Amount</span>₹{a.amount.toLocaleString('en-IN')}</p>
                            <p className="lla-mode"><span className="pq-group-label">Mode</span>{a.paymentMode || '-'}</p>
                            <p className="lla-account"><span className="pq-group-label">Account</span>{a.bankAccountId?.accountName || 'Cash'}</p>
                            <p className="lla-notes"><span className="pq-group-label">Notes</span>{a.notes || '-'}</p>
                            <div className="action-buttons lla-actions">
                                <button type="button" onClick={() => setConfirmRemove({ kind: 'advance', id: a._id, label: `₹${a.amount.toLocaleString('en-IN')} advance` })} className="pq-btn-ghost-danger" title="Remove advance" aria-label="Remove advance">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {advanceModalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay lla-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal lla-modal">
                        <div className="lla-modal-header">
                            <h2>Add Advance</h2>
                            <p className="admin-subtitle" style={{ margin: 0 }}>
                                Current {totals.balancePayable < 0 ? 'Total Extra Paid' : 'Balance Payable'}: <span style={{ fontWeight: 700, color: totals.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(totals.balancePayable).toLocaleString('en-IN')}</span>
                                {totals.balancePayable < 0 && ` (${extraPaidSub(totals)})`}
                            </p>
                        </div>
                        <div className="lla-modal-body">
                        <form id="labour-advance-form" onSubmit={submitAdvance}>
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
                        <div className="edit-modal-actions lla-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setAdvanceModalOpen(false)}>Cancel</button>
                            <button type="submit" form="labour-advance-form" className="add-btn" disabled={saving === 'advance'}>{saving === 'advance' ? 'Saving…' : 'Save'}</button>
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
                "Supervisor caught it" also credits that supervisor an incentive for the same amount. "Engineer review" is just a cut here, periodic, not tied to a specific day's entry.
                {ledger.deductions.some(d => d.workReviewCycle != null) && (
                    <> Rows with Origin <b>Review</b> came from a Work Review's rejection distribution — their <b>Amount</b> is already reflected in Approved Earnings above, so it isn't counted again in the Deductions total below (only <b>Manual</b> rows' Amount is). Their <b>Material Waste</b>, if any, is different — always an additional, real deduction on top.</>
                )}
            </p>
            {showWorks && ledger.works.length === 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '20px' }}>No works for this labourer yet; a deduction needs a work to derive its rate from.</p>
            )}
            {ledger.deductions.length === 0 ? (
                <div className="admin-empty-state"><p>No deductions yet.</p></div>
            ) : (
                <div className="dash-chart-card lld-card" style={{ marginBottom: '28px' }}>
                    <div className="lld-row lld-header">
                        <b className="lld-date">Date</b>
                        <b className="lld-sqft">Sqft</b>
                        <b className="lld-amount">Amount</b>
                        <b className="lld-waste">Material Waste</b>
                        <b className="lld-reason">Reason</b>
                        <b className="lld-caughtby">Caught By</b>
                        <b className="lld-origin">Origin</b>
                        <b className="lld-work">Work</b>
                        <b className="lld-actions">Action</b>
                    </div>
                    {ledger.deductions.map(d => (
                        <div key={d._id} className="lld-row">
                            <p className="lld-date"><span className="pq-group-label">Date</span>{new Date(d.date).toLocaleDateString()}</p>
                            <p className="lld-sqft"><span className="pq-group-label">Sqft</span>{d.areaSqft ?? '-'}</p>
                            <p className="lld-amount"><span className="pq-group-label">Amount</span>₹{d.amount.toLocaleString('en-IN')}</p>
                            <p className="lld-waste"><span className="pq-group-label">Material Waste</span>{d.materialWasteAmount > 0 ? `₹${d.materialWasteAmount.toLocaleString('en-IN')}` : '-'}</p>
                            <p className="lld-reason"><span className="pq-group-label">Reason</span>{d.reason}</p>
                            <p className="lld-caughtby"><span className="pq-group-label">Caught By</span>{d.source === 'supervisor_catch' ? `Supervisor${d.supervisorId?.name ? ` (${d.supervisorId.name})` : ''}` : 'Engineer'}</p>
                            <p className="lld-origin" style={{ color: d.workReviewCycle != null ? 'var(--text-lt)' : 'inherit', fontWeight: d.workReviewCycle == null ? 600 : 400 }}>
                                <span className="pq-group-label">Origin</span>
                                {d.workReviewCycle != null ? 'Review' : 'Manual'}
                            </p>
                            <p className="lld-work"><span className="pq-group-label">Work</span>{ledger.works.find(w => w._id === (d.workId?._id || d.workId))?.workType || '-'}</p>
                            <div className="action-buttons lld-actions">
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
                <div className="submit-loader-overlay lld-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal lld-modal">
                        <div className="lld-modal-header">
                            <h2>Add Deduction</h2>
                        </div>
                        <div className="lld-modal-body">
                        <form id="labour-deduction-form" onSubmit={submitDeduction}>
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
                                    <p>Date *</p>
                                    <StyledDatePicker value={deductionForm.date} onChange={v => setDeductionForm(p => ({ ...p, date: v }))} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Caught By *</p>
                                    <select value={deductionForm.source} onChange={e => setDeductionForm(p => ({ ...p, source: e.target.value, supervisorId: '' }))}>
                                        <option value="engineer_review">Engineer (periodic review)</option>
                                        <option value="supervisor_catch">Supervisor (caught &amp; fixed on the spot)</option>
                                    </select>
                                </div>
                                {deductionForm.source === 'supervisor_catch' && (
                                    <div className="add-product-name flex-col">
                                        <p>Supervisor *</p>
                                        <select value={deductionForm.supervisorId} onChange={e => setDeductionForm(p => ({ ...p, supervisorId: e.target.value }))}>
                                            <option value="">Select supervisor…</option>
                                            {supervisors.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Reason *</p>
                                    <input type="text" value={deductionForm.reason} onChange={e => setDeductionForm(p => ({ ...p, reason: e.target.value }))} placeholder="What went wrong, who's responsible" />
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
                        <div className="edit-modal-actions lld-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setDeductionModalOpen(false)}>Cancel</button>
                            <button type="submit" form="labour-deduction-form" className="add-btn" disabled={saving === 'deduction'}>{saving === 'deduction' ? 'Saving…' : 'Save'}</button>
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
                <div className="dash-chart-card llp-card">
                    <div className="llp-row llp-header">
                        <b className="llp-date">Date</b>
                        <b className="llp-amount">Amount</b>
                        <b className="llp-mode">Mode</b>
                        <b className="llp-account">Account</b>
                        <b className="llp-tds">TDS</b>
                        <b className="llp-notes">Notes</b>
                        <b className="llp-actions">Action</b>
                    </div>
                    {ledger.payments.map(p => (
                        <div key={p._id} className="llp-row">
                            <p className="llp-date"><span className="pq-group-label">Date</span>{new Date(p.date).toLocaleDateString()}</p>
                            <p className="llp-amount"><span className="pq-group-label">Amount</span>₹{p.amount.toLocaleString('en-IN')}</p>
                            <p className="llp-mode"><span className="pq-group-label">Mode</span>{p.paymentMode || '-'}</p>
                            <p className="llp-account"><span className="pq-group-label">Account</span>{p.bankAccountId?.accountName || 'Cash'}</p>
                            <p className="llp-tds"><span className="pq-group-label">TDS</span>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                            <p className="llp-notes"><span className="pq-group-label">Notes</span>{p.notes || '-'}</p>
                            <div className="action-buttons llp-actions">
                                <button type="button" onClick={() => setConfirmRemove({ kind: 'payment', id: p._id, label: `₹${p.amount.toLocaleString('en-IN')} payment` })} className="pq-btn-ghost-danger" title="Remove payment" aria-label="Remove payment">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {paymentModalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay llp-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal llp-modal">
                        <div className="llp-modal-header">
                            <h2>Add Payment</h2>
                            <p className="admin-subtitle" style={{ margin: 0 }}>
                                {totals.balancePayable < 0 ? 'Total Extra Paid' : 'Payment Left'}: <span style={{ fontWeight: 700, color: totals.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(totals.balancePayable).toLocaleString('en-IN')}</span>
                                {totals.balancePayable < 0 && ` (${extraPaidSub(totals)})`}
                            </p>
                        </div>
                        <div className="llp-modal-body">
                        <form id="labour-payment-form" onSubmit={submitPayment}>
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
                                    <SettingSelectField settingType="payment_mode" options={paymentModes.map(m => ({ _id: m, name: m }))}
                                        value={paymentForm.paymentMode} onChange={v => setPaymentForm(p => ({ ...p, paymentMode: v }))} placeholder="e.g. Cash, Bank Transfer, UPI…" />
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
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Notes</p>
                                    <input type="text" value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} />
                                </div>
                            </div>
                            {paymentForm.amount > 0 && (
                                <p className="admin-subtitle" style={{ margin: '-8px 0 12px' }}>
                                    {paymentForm.tdsAmount > 0 ? (
                                        <>Amount entered ₹{Number(paymentForm.amount).toLocaleString('en-IN')} (before TDS) · TDS to withhold ₹{Number(paymentForm.tdsAmount).toLocaleString('en-IN')} · <b>Actual amount to pay: ₹{(Number(paymentForm.amount) - Number(paymentForm.tdsAmount)).toLocaleString('en-IN')}</b></>
                                    ) : (
                                        <b>Actual amount to pay: ₹{Number(paymentForm.amount).toLocaleString('en-IN')}</b>
                                    )}
                                </p>
                            )}
                        </form>
                        </div>
                        <div className="edit-modal-actions llp-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setPaymentModalOpen(false)}>Cancel</button>
                            <button type="submit" form="labour-payment-form" className="add-btn" disabled={saving === 'payment'}>{saving === 'payment' ? 'Saving…' : 'Save'}</button>
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

export default LabourLedgerView;
