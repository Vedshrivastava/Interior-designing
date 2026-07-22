import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartCard, EmptyChart, CHART_COLORS, formatINR } from './DashboardWidgets';
import StyledDatePicker from './StyledDatePicker';
import '../../styles/list.css';
import '../../styles/dashboard.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyPaymentForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '' };

// Monthly purchases/returns/payments — derived from the ledger response
// already fetched here, no separate endpoint needed.
const buildMonthlyMoneyFlow = (purchases, returns, payments) => {
    const byMonth = new Map();
    const bump = (date, field, amount) => {
        const month = new Date(date).toISOString().slice(0, 7);
        if (!byMonth.has(month)) byMonth.set(month, { month, purchases: 0, returns: 0, payments: 0 });
        byMonth.get(month)[field] += amount;
    };
    purchases.forEach(p => bump(p.date, 'purchases', p.totalAmount));
    returns.forEach(r => bump(r.date, 'returns', r.totalAmount));
    payments.forEach(p => bump(p.date, 'payments', p.amount));
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
};

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
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
    const [paymentFile, setPaymentFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
            .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

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
            if (res.data.success) { toast.success(res.data.message); setPaymentForm(emptyPaymentForm); setPaymentFile(null); setPaymentModalOpen(false); await fetchLedger(); }
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
    const monthlyFlow = buildMonthlyMoneyFlow(ledger.purchases, ledger.returns, ledger.payments);

    return (
        <div>
            <div className="list-table finance-table" style={{ marginBottom: '28px' }}>
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

            <div style={{ marginBottom: '28px' }}>
                <ChartCard title="Purchases / Returns / Payments, by month">
                    {monthlyFlow.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={monthlyFlow}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v) => formatINR(v)} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="purchases" name="Purchases" fill={CHART_COLORS[1]} />
                                <Bar dataKey="returns" name="Returns" fill={CHART_COLORS[2]} />
                                <Bar dataKey="payments" name="Payments" fill={CHART_COLORS[0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart text="No purchases, returns, or payments yet." />}
                </ChartCard>
            </div>

            <h3 style={{ marginBottom: '8px' }}>Purchases</h3>
            <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                    <b>Date</b><b>Project</b><b>Material</b><b>Qty</b><b>Total</b>
                </div>
                {ledger.purchases.length === 0 ? (
                    <div className="admin-empty-state"><p>No purchases yet.</p></div>
                ) : ledger.purchases.map(p => (
                    <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                        <p>{new Date(p.date).toLocaleDateString()}</p>
                        <p>{p.projectId?.name || '-'}</p>
                        <p>{p.materialId?.name || '-'}</p>
                        <p>{p.quantity} {p.materialId?.unit || ''}</p>
                        <p>₹{p.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>

            <h3 style={{ marginBottom: '8px' }}>Returns</h3>
            <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                    <b>Date</b><b>Project</b><b>Material</b><b>Qty</b><b>Total</b>
                </div>
                {ledger.returns.length === 0 ? (
                    <div className="admin-empty-state"><p>No returns yet.</p></div>
                ) : ledger.returns.map(r => (
                    <div key={r._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                        <p>{new Date(r.date).toLocaleDateString()}</p>
                        <p>{r.projectId?.name || '-'}</p>
                        <p>{r.materialId?.name || '-'}</p>
                        <p>{r.quantity} {r.materialId?.unit || ''}</p>
                        <p>₹{r.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0 }}>Payments</h3>
                <button type="button" className="add-btn" onClick={() => setPaymentModalOpen(true)}>+ Add Payment</button>
            </div>
            {ledger.payments.length === 0 ? (
                <div className="admin-empty-state"><p>No payments yet.</p></div>
            ) : (
                <div className="list-table finance-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 100px' }}>
                        <b>Date</b><b>Amount</b><b>Mode</b><b>Account</b><b>TDS</b><b>Attachment</b><b>Action</b>
                    </div>
                    {ledger.payments.map(p => (
                        <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 100px' }}>
                            <p>{new Date(p.date).toLocaleDateString()}</p>
                            <p>₹{p.amount.toLocaleString('en-IN')}</p>
                            <p>{p.paymentMode || '-'}</p>
                            <p>{p.bankAccountId?.accountName || 'Cash'}</p>
                            <p>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                            <p>{p.attachmentUrl ? <a href={p.attachmentUrl} target="_blank" rel="noreferrer">View</a> : '-'}</p>
                            <div className="action-buttons"><p onClick={() => removePayment(p._id)} className="cursor delete-action">X</p></div>
                        </div>
                    ))}
                </div>
            )}

            {paymentModalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Add Payment</h2>
                        <form onSubmit={submitPayment}>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Amount (₹) *</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} />
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
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={paymentForm.tdsAmount} onChange={e => setPaymentForm(p => ({ ...p, tdsAmount: e.target.value }))} />
                                </div>
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Attachment</p>
                                    <input type="file" onChange={e => setPaymentFile(e.target.files[0] || null)} />
                                </div>
                            </div>
                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={() => setPaymentModalOpen(false)}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default VendorLedgerView;
