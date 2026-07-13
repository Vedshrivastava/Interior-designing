import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const emptyPaymentForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', utrNumber: '', notes: '' };

/*
 * The full vendor ledger — purchases, returns, payments, and the computed
 * Amount Owed (purchases − returns − payments). Mirrors
 * ContractorLedgerView's shape; purchases/returns themselves are entered
 * on Procurement's own tabs (they also auto-create stock movements, which
 * this view doesn't need to duplicate), so only the payment form lives
 * here alongside the read-only breakdown.
 */
const VendorLedgerView = ({ url, vendorId, projectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [ledger, setLedger] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
    const [paymentFile, setPaymentFile] = useState(null);
    const [saving, setSaving] = useState(false);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/vendors/${vendorId}/ledger`, { ...authHeader, params: projectId ? { projectId } : {} });
            if (res.data.success) setLedger(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching ledger'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (vendorId) fetchLedger(); }, [vendorId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const submitPayment = async (e) => {
        e.preventDefault();
        if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!paymentForm.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const data = new FormData();
            Object.entries(paymentForm).forEach(([k, v]) => data.append(k, v));
            data.append('vendorId', vendorId);
            data.append('projectId', projectId || '');
            if (paymentFile) data.append('attachment', paymentFile);
            const res = await axios.post(`${url}/api/finance/vendor-payments/add`, data, {
                headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) { toast.success(res.data.message); setPaymentForm(emptyPaymentForm); setPaymentFile(null); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording payment'); }
        finally { setSaving(false); }
    };

    const removePayment = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/vendor-payments/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing payment'); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!ledger) return <div className="admin-empty-state"><p>Unable to load ledger.</p></div>;

    const { totals } = ledger;

    return (
        <div>
            <div className="list-table" style={{ marginBottom: '28px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <b>Purchases</b><b>Returns</b><b>Payments</b><b>Amount Owed</b>
                </div>
                <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <p>₹{totals.purchases.toLocaleString('en-IN')}</p>
                    <p>₹{totals.returns.toLocaleString('en-IN')}</p>
                    <p>₹{totals.payments.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 700, color: totals.amountOwed > 0 ? '#c0392b' : 'var(--moss)' }}>₹{totals.amountOwed.toLocaleString('en-IN')}</p>
                </div>
            </div>

            <h3 style={{ marginBottom: '8px' }}>Purchases</h3>
            <div className="list-table" style={{ marginBottom: '24px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                    <b>Date</b><b>Project</b><b>Material</b><b>Qty</b><b>Total</b>
                </div>
                {ledger.purchases.length === 0 ? (
                    <div className="admin-empty-state"><p>No purchases yet.</p></div>
                ) : ledger.purchases.map(p => (
                    <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                        <p>{new Date(p.date).toLocaleDateString()}</p>
                        <p>{p.projectId?.name || '—'}</p>
                        <p>{p.materialId?.name || '—'}</p>
                        <p>{p.quantity}</p>
                        <p>₹{p.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>

            <h3 style={{ marginBottom: '8px' }}>Returns</h3>
            <div className="list-table" style={{ marginBottom: '24px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                    <b>Date</b><b>Project</b><b>Material</b><b>Qty</b><b>Total</b>
                </div>
                {ledger.returns.length === 0 ? (
                    <div className="admin-empty-state"><p>No returns yet.</p></div>
                ) : ledger.returns.map(r => (
                    <div key={r._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                        <p>{new Date(r.date).toLocaleDateString()}</p>
                        <p>{r.projectId?.name || '—'}</p>
                        <p>{r.materialId?.name || '—'}</p>
                        <p>{r.quantity}</p>
                        <p>₹{r.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>

            <h3 style={{ marginBottom: '8px' }}>Payments</h3>
            <form onSubmit={submitPayment} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <input type="number" placeholder="Amount" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} style={{ flex: 1, minWidth: '100px' }} />
                <input type="date" value={paymentForm.date} onChange={e => setPaymentForm(p => ({ ...p, date: e.target.value }))} style={{ flex: 1, minWidth: '140px' }} />
                <input type="text" placeholder="Payment mode" value={paymentForm.paymentMode} onChange={e => setPaymentForm(p => ({ ...p, paymentMode: e.target.value }))} style={{ flex: 1, minWidth: '120px' }} />
                <input type="file" onChange={e => setPaymentFile(e.target.files[0] || null)} style={{ flex: 1, minWidth: '160px' }} />
                <button type="submit" className="add-point-btn" disabled={saving}>{saving ? 'Saving…' : '+ Add Payment'}</button>
            </form>
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                    <b>Date</b><b>Amount</b><b>Mode</b><b>Attachment</b><b>Action</b>
                </div>
                {ledger.payments.length === 0 ? (
                    <div className="admin-empty-state"><p>No payments yet.</p></div>
                ) : ledger.payments.map(p => (
                    <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                        <p>{new Date(p.date).toLocaleDateString()}</p>
                        <p>₹{p.amount.toLocaleString('en-IN')}</p>
                        <p>{p.paymentMode || '—'}</p>
                        <p>{p.attachmentUrl ? <a href={p.attachmentUrl} target="_blank" rel="noreferrer">View</a> : '—'}</p>
                        <div className="action-buttons"><p onClick={() => removePayment(p._id)} className="cursor delete-action">X</p></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VendorLedgerView;
