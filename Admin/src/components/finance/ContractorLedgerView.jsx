import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const emptyAdvanceForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', utrNumber: '', notes: '' };
const emptyDeductionForm = { amount: '', reason: '', date: '', notes: '' };
const emptyPaymentForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '' };

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
        if (!deductionForm.amount || Number(deductionForm.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!deductionForm.reason.trim()) return toast.error('Reason is required');
        if (!deductionForm.date) return toast.error('Date is required');
        setSaving('deduction');
        try {
            const res = await axios.post(`${url}/api/finance/contractor-deductions/add`, { ...deductionForm, vendorId, projectId: projectId || null }, authHeader);
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

    return (
        <div>
            <div className="list-table" style={{ marginBottom: '28px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                    <b>Earnings</b><b>Advances</b><b>Deductions</b><b>Payments</b><b>Balance Payable</b>
                </div>
                <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                    <p>₹{totals.earnings.toLocaleString('en-IN')}</p>
                    <p>₹{totals.advances.toLocaleString('en-IN')}</p>
                    <p>₹{totals.deductions.toLocaleString('en-IN')}</p>
                    <p>₹{totals.payments.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 700, color: totals.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{totals.balancePayable.toLocaleString('en-IN')}</p>
                </div>
            </div>

            {showWorks && (
                <>
                    <h3 style={{ marginBottom: '8px' }}>Works & Earnings</h3>
                    <div className="list-table" style={{ marginBottom: '28px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1.4fr 1fr' }}>
                            <b>Project</b><b>Work Type</b><b>Completed / Estimated</b><b>Earnings</b>
                        </div>
                        {ledger.works.length === 0 ? (
                            <div className="admin-empty-state"><p>No works for this contractor yet.</p></div>
                        ) : (
                            ledger.works.map(w => (
                                <div key={w._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1.4fr 1fr' }}>
                                    <p>{w.projectName}</p>
                                    <p>{w.workType} <span className="admin-subtitle" style={{ display: 'inline' }}>({w.teamName})</span></p>
                                    <p>{w.completedAreaSqft} / {w.estimatedAreaSqft} sqft</p>
                                    <p>{w.rate ? `₹${w.earnings.toLocaleString('en-IN')}` : <span title="No matching team rate configured">— (no rate)</span>}</p>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            <h3 style={{ marginBottom: '8px' }}>Advances</h3>
            <form onSubmit={submitAdvance} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <input type="number" placeholder="Amount" value={advanceForm.amount} onChange={e => setAdvanceForm(p => ({ ...p, amount: e.target.value }))} style={{ flex: 1, minWidth: '100px' }} />
                <input type="date" value={advanceForm.date} onChange={e => setAdvanceForm(p => ({ ...p, date: e.target.value }))} style={{ flex: 1, minWidth: '140px' }} />
                <input type="text" placeholder="Payment mode" value={advanceForm.paymentMode} onChange={e => setAdvanceForm(p => ({ ...p, paymentMode: e.target.value }))} style={{ flex: 1, minWidth: '120px' }} />
                <input type="text" placeholder="Notes" value={advanceForm.notes} onChange={e => setAdvanceForm(p => ({ ...p, notes: e.target.value }))} style={{ flex: 1, minWidth: '140px' }} />
                <button type="submit" className="add-point-btn" disabled={saving === 'advance'}>{saving === 'advance' ? 'Saving…' : '+ Add Advance'}</button>
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
                        <p>{a.paymentMode || '—'}</p>
                        <p>{a.notes || '—'}</p>
                        <div className="action-buttons"><p onClick={() => remove('advance', a._id)} className="cursor delete-action">X</p></div>
                    </div>
                ))}
            </div>

            <h3 style={{ marginBottom: '8px' }}>Deductions</h3>
            <form onSubmit={submitDeduction} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <input type="number" placeholder="Amount" value={deductionForm.amount} onChange={e => setDeductionForm(p => ({ ...p, amount: e.target.value }))} style={{ flex: 1, minWidth: '100px' }} />
                <input type="text" placeholder="Reason" value={deductionForm.reason} onChange={e => setDeductionForm(p => ({ ...p, reason: e.target.value }))} style={{ flex: 2, minWidth: '180px' }} />
                <input type="date" value={deductionForm.date} onChange={e => setDeductionForm(p => ({ ...p, date: e.target.value }))} style={{ flex: 1, minWidth: '140px' }} />
                <button type="submit" className="add-point-btn" disabled={saving === 'deduction'}>{saving === 'deduction' ? 'Saving…' : '+ Add Deduction'}</button>
            </form>
            <div className="list-table" style={{ marginBottom: '28px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1.5fr 100px' }}>
                    <b>Date</b><b>Amount</b><b>Reason</b><b>Action</b>
                </div>
                {ledger.deductions.length === 0 ? (
                    <div className="admin-empty-state"><p>No deductions yet.</p></div>
                ) : ledger.deductions.map(d => (
                    <div key={d._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1.5fr 100px' }}>
                        <p>{new Date(d.date).toLocaleDateString()}</p>
                        <p>₹{d.amount.toLocaleString('en-IN')}</p>
                        <p>{d.reason}</p>
                        <div className="action-buttons"><p onClick={() => remove('deduction', d._id)} className="cursor delete-action">X</p></div>
                    </div>
                ))}
            </div>

            <h3 style={{ marginBottom: '8px' }}>Payments</h3>
            <form onSubmit={submitPayment} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <input type="number" placeholder="Amount" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} style={{ flex: 1, minWidth: '100px' }} />
                <input type="date" value={paymentForm.date} onChange={e => setPaymentForm(p => ({ ...p, date: e.target.value }))} style={{ flex: 1, minWidth: '140px' }} />
                <input type="text" placeholder="Payment mode" value={paymentForm.paymentMode} onChange={e => setPaymentForm(p => ({ ...p, paymentMode: e.target.value }))} style={{ flex: 1, minWidth: '120px' }} />
                <select value={paymentForm.bankAccountId} onChange={e => setPaymentForm(p => ({ ...p, bankAccountId: e.target.value }))} style={{ flex: 1, minWidth: '160px' }}>
                    <option value="">— Cash —</option>
                    {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.accountName} — {a.bankName}</option>)}
                </select>
                <input type="file" onChange={e => setPaymentFile(e.target.files[0] || null)} style={{ flex: 1, minWidth: '160px' }} />
                <button type="submit" className="add-point-btn" disabled={saving === 'payment'}>{saving === 'payment' ? 'Saving…' : '+ Add Payment'}</button>
            </form>
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 100px' }}>
                    <b>Date</b><b>Amount</b><b>Mode</b><b>Account</b><b>Attachment</b><b>Action</b>
                </div>
                {ledger.payments.length === 0 ? (
                    <div className="admin-empty-state"><p>No payments yet.</p></div>
                ) : ledger.payments.map(p => (
                    <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 100px' }}>
                        <p>{new Date(p.date).toLocaleDateString()}</p>
                        <p>₹{p.amount.toLocaleString('en-IN')}</p>
                        <p>{p.paymentMode || '—'}</p>
                        <p>{p.bankAccountId?.accountName || 'Cash'}</p>
                        <p>{p.attachmentUrl ? <a href={p.attachmentUrl} target="_blank" rel="noreferrer">View</a> : '—'}</p>
                        <div className="action-buttons"><p onClick={() => remove('payment', p._id)} className="cursor delete-action">X</p></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContractorLedgerView;
