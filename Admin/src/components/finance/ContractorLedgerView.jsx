import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartCard, EmptyChart, CHART_COLORS, formatINR } from './DashboardWidgets';
import StyledSelect from './StyledSelect';
import DownloadButton from './DownloadButton';
import { useFileDownload } from '../../hooks/useFileDownload';
import StyledDatePicker from './StyledDatePicker';
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

const emptyAdvanceForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', utrNumber: '', notes: '' };
const emptyDeductionForm = { areaSqft: '', reason: '', date: '', notes: '', workId: '' };
const emptyPaymentForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '' };

/*
 * The full contractor ledger — earnings breakdown, and add/list/remove for
 * advances, deductions, and payments, ending in the computed Balance
 * Payable. This is what both the Contractors page's "Ledger" and
 * "Settlements" tabs render (identical view, per spec — Settlements was
 * reserved for exactly this) and what Payables' Contractor tab and
 * Payments' Contractor Payment tab pull their numbers/forms from.
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
    const [billProjectId, setBillProjectId] = useState('');
    const { downloading: downloadingBill, progress: billProgress, run: runBillDownload } = useFileDownload(authHeader);

    const [advanceForm, setAdvanceForm] = useState(emptyAdvanceForm);
    const [deductionForm, setDeductionForm] = useState(emptyDeductionForm);
    const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
    const [paymentFile, setPaymentFile] = useState(null);
    const [saving, setSaving] = useState('');

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
    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
            .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const submitAdvance = async (e) => {
        e.preventDefault();
        if (!advanceForm.amount || Number(advanceForm.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!advanceForm.date) return toast.error('Date is required');
        setSaving('advance');
        try {
            const res = await axios.post(`${url}/api/finance/contractor-advances/add`, { ...advanceForm, vendorId, projectId: projectId || null }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setAdvanceForm(emptyAdvanceForm); await fetchLedger(); }
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
            if (res.data.success) { toast.success(res.data.message); setDeductionForm(emptyDeductionForm); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording deduction'); }
        finally { setSaving(''); }
    };

    const submitPayment = async (e) => {
        e.preventDefault();
        if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!paymentForm.date) return toast.error('Date is required');
        setSaving('payment');
        try {
            const data = new FormData();
            Object.entries(paymentForm).forEach(([k, v]) => data.append(k, v));
            data.append('vendorId', vendorId);
            data.append('projectId', projectId || '');
            if (paymentFile) data.append('attachment', paymentFile);
            const res = await axios.post(`${url}/api/finance/contractor-payments/add`, data, {
                headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) { toast.success(res.data.message); setPaymentForm(emptyPaymentForm); setPaymentFile(null); await fetchLedger(); }
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

    const remove = async (kind, id) => {
        const endpoint = { advance: 'contractor-advances', deduction: 'contractor-deductions', payment: 'contractor-payments' }[kind];
        try {
            const res = await axios.delete(`${url}/api/finance/${endpoint}/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch { toast.error(`Error removing ${kind}`); }
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
                        value={billProjectId} onChange={setBillProjectId} placeholder="Select project…"
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

            <div className="list-table" style={{ marginBottom: '8px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                    <b>Total (All Logged)</b><b>Approved (Reviewed)</b><b>Unapproved</b><b>Advances</b><b>Deductions</b><b>Payments</b><b>{totals.balancePayable < 0 ? 'Extra Paid' : 'Balance Payable'}</b>
                </div>
                <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                    <p>₹{totals.totalAmount.toLocaleString('en-IN')}</p>
                    <p style={{ color: totals.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}>{totals.earnings > 0 ? `₹${totals.earnings.toLocaleString('en-IN')}` : 'Unapproved'}</p>
                    <p style={{ color: totals.unapprovedAmount > 0 ? '#c0392b' : 'var(--text-lt)' }}>₹{totals.unapprovedAmount.toLocaleString('en-IN')}</p>
                    <p>₹{totals.advances.toLocaleString('en-IN')}</p>
                    <p>₹{totals.deductions.toLocaleString('en-IN')}</p>
                    <p>₹{totals.payments.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 700, color: totals.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{Math.abs(totals.balancePayable).toLocaleString('en-IN')}</p>
                </div>
            </div>
            {totals.unapprovedAmount > 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                    ₹{totals.unapprovedAmount.toLocaleString('en-IN')} worth of measured work hasn't been reviewed yet; it isn't counted as Approved earnings until it's reviewed (Payables/Receivables → Deductions).
                </p>
            )}
            {totals.balancePayable < 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                    Paid more than currently-approved work earns — some already-paid work is still pending review, not a balance owed back.
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
                                <Tooltip formatter={(v) => formatINR(v)} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="advances" name="Advances" fill={CHART_COLORS[1]} />
                                <Bar dataKey="deductions" name="Deductions" fill={CHART_COLORS[2]} />
                                <Bar dataKey="payments" name="Payments" fill={CHART_COLORS[0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart text="No advances, deductions, or payments yet." />}
                </ChartCard>
            </div>

            {showWorks && (
                <>
                    <h3 style={{ marginBottom: '8px' }}>Works & Earnings</h3>
                    <div className="list-table" style={{ marginBottom: '28px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.1fr 0.9fr 1fr 0.9fr 1.1fr 0.9fr' }}>
                            <b>Project</b><b>Work Type</b><b>Done / Estimated</b><b>Total</b><b>Approved (as of)</b><b>Unapproved</b>
                        </div>
                        {ledger.works.length === 0 ? (
                            <div className="admin-empty-state"><p>No works for this contractor yet.</p></div>
                        ) : (
                            ledger.works.map(w => (
                                <div key={w._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.1fr 0.9fr 1fr 0.9fr 1.1fr 0.9fr' }}>
                                    <p>{w.projectName}</p>
                                    <p>{w.workType}</p>
                                    <p>{w.completedAreaSqft} / {w.estimatedAreaSqft} sqft</p>
                                    <p>{w.rate ? `₹${w.totalAmount.toLocaleString('en-IN')}` : <span title="No matching contractor rate configured">(no rate)</span>}</p>
                                    <p style={{ color: w.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}>
                                        {w.earnings > 0
                                            ? <>₹{w.earnings.toLocaleString('en-IN')} <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>({w.approvedAreaSqft} sqft{w.approvedDate ? `, ${new Date(w.approvedDate).toLocaleDateString()}` : ''})</span></>
                                            : 'Unapproved'}
                                    </p>
                                    <p style={{ color: w.unapprovedAmount > 0 ? '#c0392b' : 'var(--text-lt)' }}>{w.rate ? `₹${w.unapprovedAmount.toLocaleString('en-IN')}` : '-'}</p>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            <h3 style={{ marginBottom: '8px' }}>Advances</h3>
            <form onSubmit={submitAdvance}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Amount (₹) *</p>
                        <input type="number" value={advanceForm.amount} onChange={e => setAdvanceForm(p => ({ ...p, amount: e.target.value }))} />
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
                        <p>Notes</p>
                        <input type="text" value={advanceForm.notes} onChange={e => setAdvanceForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px', marginBottom: '12px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving === 'advance'}>{saving === 'advance' ? 'Saving…' : '+ Add Advance'}</button>
                </div>
            </form>
            <div className="list-table" style={{ marginBottom: '28px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                    <b>Date</b><b>Amount</b><b>Mode</b><b>Notes</b><b>Action</b>
                </div>
                {ledger.advances.length === 0 ? (
                    <div className="admin-empty-state"><p>No advances yet.</p></div>
                ) : ledger.advances.map(a => (
                    <div key={a._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                        <p>{new Date(a.date).toLocaleDateString()}</p>
                        <p>₹{a.amount.toLocaleString('en-IN')}</p>
                        <p>{a.paymentMode || '-'}</p>
                        <p>{a.notes || '-'}</p>
                        <div className="action-buttons"><p onClick={() => remove('advance', a._id)} className="cursor delete-action">X</p></div>
                    </div>
                ))}
            </div>

            <h3 style={{ marginBottom: '8px' }}>Deductions</h3>
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>
                Sqft in, ₹ out: the amount is always derived from the picked work's rate, never typed directly.
            </p>
            {showWorks && ledger.works.length === 0 ? (
                <p className="admin-subtitle" style={{ marginBottom: '20px' }}>No works for this contractor yet; a deduction needs a work to derive its rate from.</p>
            ) : (
                <form onSubmit={submitDeduction}>
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
                            <input type="number" value={deductionForm.areaSqft} onChange={e => setDeductionForm(p => ({ ...p, areaSqft: e.target.value }))} />
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
                    <div className="wizard-actions" style={{ marginTop: '16px', marginBottom: '12px' }}>
                        <span />
                        <button type="submit" className="add-btn" disabled={saving === 'deduction'}>{saving === 'deduction' ? 'Saving…' : '+ Add Deduction'}</button>
                    </div>
                </form>
            )}
            <div className="list-table" style={{ marginBottom: '28px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 0.8fr 1fr 1.3fr 1fr 100px' }}>
                    <b>Date</b><b>Sqft</b><b>Amount</b><b>Reason</b><b>Work</b><b>Action</b>
                </div>
                {ledger.deductions.length === 0 ? (
                    <div className="admin-empty-state"><p>No deductions yet.</p></div>
                ) : ledger.deductions.map(d => (
                    <div key={d._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 0.8fr 1fr 1.3fr 1fr 100px' }}>
                        <p>{new Date(d.date).toLocaleDateString()}</p>
                        <p>{d.areaSqft ?? '-'}</p>
                        <p>₹{d.amount.toLocaleString('en-IN')}</p>
                        <p>{d.reason}</p>
                        <p>{ledger.works.find(w => w._id === (d.workId?._id || d.workId))?.workType || '-'}</p>
                        <div className="action-buttons"><p onClick={() => remove('deduction', d._id)} className="cursor delete-action">X</p></div>
                    </div>
                ))}
            </div>

            <h3 style={{ marginBottom: '8px' }}>Payments</h3>
            <form onSubmit={submitPayment}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Amount (₹) *</p>
                        <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Date *</p>
                        <StyledDatePicker value={paymentForm.date} onChange={v => setPaymentForm(p => ({ ...p, date: v }))} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Payment Mode</p>
                        <input type="text" value={paymentForm.paymentMode} onChange={e => setPaymentForm(p => ({ ...p, paymentMode: e.target.value }))} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Bank Account</p>
                        <select value={paymentForm.bankAccountId} onChange={e => setPaymentForm(p => ({ ...p, bankAccountId: e.target.value }))}>
                            <option value="">Cash</option>
                            {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.accountName} · {a.bankName}</option>)}
                        </select>
                    </div>
                    <div className="add-product-name flex-col">
                        <p>TDS Section</p>
                        <select value={paymentForm.tdsSectionId} onChange={e => setPaymentForm(p => ({ ...p, tdsSectionId: e.target.value }))}>
                            <option value="">No TDS</option>
                            {tdsSections.map(s => <option key={s._id} value={s._id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                        </select>
                    </div>
                    <div className="add-product-name flex-col">
                        <p>TDS Amount (optional)</p>
                        <input type="number" value={paymentForm.tdsAmount} onChange={e => setPaymentForm(p => ({ ...p, tdsAmount: e.target.value }))} />
                    </div>
                    <div className="add-product-name flex-col wizard-field-full">
                        <p>Attachment</p>
                        <input type="file" onChange={e => setPaymentFile(e.target.files[0] || null)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px', marginBottom: '12px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving === 'payment'}>{saving === 'payment' ? 'Saving…' : '+ Add Payment'}</button>
                </div>
            </form>
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 100px' }}>
                    <b>Date</b><b>Amount</b><b>Mode</b><b>Account</b><b>TDS</b><b>Attachment</b><b>Action</b>
                </div>
                {ledger.payments.length === 0 ? (
                    <div className="admin-empty-state"><p>No payments yet.</p></div>
                ) : ledger.payments.map(p => (
                    <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 100px' }}>
                        <p>{new Date(p.date).toLocaleDateString()}</p>
                        <p>₹{p.amount.toLocaleString('en-IN')}</p>
                        <p>{p.paymentMode || '-'}</p>
                        <p>{p.bankAccountId?.accountName || 'Cash'}</p>
                        <p>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                        <p>{p.attachmentUrl ? <a href={p.attachmentUrl} target="_blank" rel="noreferrer">View</a> : '-'}</p>
                        <div className="action-buttons"><p onClick={() => remove('payment', p._id)} className="cursor delete-action">X</p></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContractorLedgerView;
