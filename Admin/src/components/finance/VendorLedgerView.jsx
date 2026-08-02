import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { KpiCard, KpiGrid, ChartCard, EmptyChart, ChartTooltip, CHART_COLORS, formatINR } from './DashboardWidgets';
import StyledDatePicker from './StyledDatePicker';
import SettingSelectField, { registerSettingIfNew } from './SettingSelectField';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import ViewAttachmentLink from './ViewAttachmentLink';
import '../../styles/list.css';
import '../../styles/dashboard.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyPaymentForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '', isRefund: false };

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
    const [paymentModes, setPaymentModes] = useState([]);
    const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
    const [paymentFile, setPaymentFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [confirmPayment, setConfirmPayment] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
            .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'payment_mode' } })
            .then(res => { if (res.data.success) setPaymentModes(res.data.data.map(s => s.name)); }).catch(() => {});
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

    // A payment/purchase/return recorded elsewhere for this same vendor
    // (the standalone Vendor Payment tab, Procurement's Purchases tab)
    // wouldn't otherwise show up here until the vendor was reselected.
    useFinanceWsRefresh(['financeVendorLedgerChanged', 'financePurchasesChanged'], (msg) => { if (vendorId && (!msg.vendorId || msg.vendorId === vendorId)) fetchLedger(); });

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
            if (res.data.success) {
                if (paymentForm.paymentMode) await registerSettingIfNew(url, authHeader, 'payment_mode', paymentForm.paymentMode, paymentModes.map(m => ({ name: m })));
                toast.success(res.data.message); setPaymentForm(emptyPaymentForm); setPaymentFile(null); setPaymentModalOpen(false); await fetchLedger();
            }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording payment'); }
        finally { setSaving(false); }
    };

    const confirmRemovePayment = async () => {
        if (!confirmPayment) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/vendor-payments/remove`, { ...authHeader, data: { _id: confirmPayment._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmPayment(null); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing payment'); }
        finally { setDeleting(false); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!ledger) return <div className="admin-empty-state"><p>Unable to load ledger.</p></div>;

    const { totals } = ledger;
    const monthlyFlow = buildMonthlyMoneyFlow(ledger.purchases, ledger.returns, ledger.payments);

    return (
        <div>
            <KpiGrid>
                <KpiCard label="Purchases" value={formatINR(totals.purchases)} />
                <KpiCard label="Returns" value={formatINR(totals.returns)} />
                <KpiCard label="Payments" value={formatINR(totals.payments)} />
                {totals.refunds > 0 && <KpiCard label="Refunds Received" value={formatINR(totals.refunds)} tone="good" />}
                <KpiCard label="Amount Owed"
                    value={totals.amountOwed < 0 ? `Vendor owes us ${formatINR(Math.abs(totals.amountOwed))}` : formatINR(totals.amountOwed)}
                    tone={totals.amountOwed > 0 ? 'danger' : 'good'} />
            </KpiGrid>

            <div style={{ marginBottom: '28px' }}>
                <ChartCard title="Purchases / Returns / Payments, by month">
                    {monthlyFlow.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={monthlyFlow}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="purchases" name="Purchases" fill={CHART_COLORS[1]} activeBar={false} />
                                <Bar dataKey="returns" name="Returns" fill={CHART_COLORS[2]} activeBar={false} />
                                <Bar dataKey="payments" name="Payments" fill={CHART_COLORS[0]} activeBar={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart text="No purchases, returns, or payments yet." />}
                </ChartCard>
            </div>

            <h3 style={{ marginBottom: '8px' }}>Purchases</h3>
            {ledger.purchases.length === 0 ? (
                <div className="admin-empty-state" style={{ marginBottom: '24px' }}><p>No purchases yet.</p></div>
            ) : (
                <div className="dash-chart-card vlp-card" style={{ marginBottom: '24px' }}>
                    <div className="vlp-row vlp-header">
                        <b className="vlp-date">Date</b>
                        <b className="vlp-project">Project</b>
                        <b className="vlp-material">Material</b>
                        <b className="vlp-qty">Qty</b>
                        <b className="vlp-total">Total</b>
                    </div>
                    {ledger.purchases.map(p => (
                        <div key={p._id} className="vlp-row">
                            <p className="vlp-date"><span className="pq-group-label">Date</span>{new Date(p.date).toLocaleDateString()}</p>
                            <p className="vlp-project">{p.projectId?.name || '-'}</p>
                            <p className="vlp-material"><span className="pq-group-label">Material</span>{p.materialId?.name || '-'}</p>
                            <p className="vlp-qty"><span className="pq-group-label">Qty</span>{p.quantity} {p.materialId?.unit || ''}</p>
                            <p className="vlp-total"><span className="pq-group-label">Total</span>₹{p.totalAmount.toLocaleString('en-IN')}</p>
                        </div>
                    ))}
                </div>
            )}

            <h3 style={{ marginBottom: '8px' }}>Returns</h3>
            {ledger.returns.length === 0 ? (
                <div className="admin-empty-state" style={{ marginBottom: '24px' }}><p>No returns yet.</p></div>
            ) : (
                <div className="dash-chart-card vlp-card" style={{ marginBottom: '24px' }}>
                    <div className="vlp-row vlp-header">
                        <b className="vlp-date">Date</b>
                        <b className="vlp-project">Project</b>
                        <b className="vlp-material">Material</b>
                        <b className="vlp-qty">Qty</b>
                        <b className="vlp-total">Total</b>
                    </div>
                    {ledger.returns.map(r => (
                        <div key={r._id} className="vlp-row">
                            <p className="vlp-date"><span className="pq-group-label">Date</span>{new Date(r.date).toLocaleDateString()}</p>
                            <p className="vlp-project">{r.projectId?.name || '-'}</p>
                            <p className="vlp-material"><span className="pq-group-label">Material</span>{r.materialId?.name || '-'}</p>
                            <p className="vlp-qty"><span className="pq-group-label">Qty</span>{r.quantity} {r.materialId?.unit || ''}</p>
                            <p className="vlp-total"><span className="pq-group-label">Total</span>₹{r.totalAmount.toLocaleString('en-IN')}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="pq-section-header">
                <h3 style={{ margin: 0 }}>Payments</h3>
                <button type="button" className="add-btn" onClick={() => setPaymentModalOpen(true)}>+ Add Payment</button>
            </div>
            {ledger.payments.length === 0 ? (
                <div className="admin-empty-state"><p>No payments yet.</p></div>
            ) : (
                <div className="dash-chart-card vlpay-card">
                    <div className="vlpay-row vlpay-header">
                        <b className="vlpay-date">Date</b>
                        <b className="vlpay-type">Type</b>
                        <b className="vlpay-amount">Amount</b>
                        <b className="vlpay-mode">Mode</b>
                        <b className="vlpay-account">Account</b>
                        <b className="vlpay-tds">TDS</b>
                        <b className="vlpay-attachment">Attachment</b>
                        <b className="vlpay-actions">Action</b>
                    </div>
                    {ledger.payments.map(p => (
                        <div key={p._id} className="vlpay-row">
                            <p className="vlpay-date"><span className="pq-group-label">Date</span>{new Date(p.date).toLocaleDateString()}</p>
                            <p className="vlpay-type"><span className="pq-group-label">Type</span><span style={{ color: p.isRefund ? 'var(--moss)' : 'inherit', fontWeight: p.isRefund ? 600 : 400 }}>{p.isRefund ? 'Refund' : 'Payment'}</span></p>
                            <p className="vlpay-amount"><span className="pq-group-label">Amount</span>₹{p.amount.toLocaleString('en-IN')}</p>
                            <p className="vlpay-mode"><span className="pq-group-label">Mode</span>{p.paymentMode || '-'}</p>
                            <p className="vlpay-account"><span className="pq-group-label">Account</span>{p.bankAccountId?.accountName || 'Cash'}</p>
                            <p className="vlpay-tds"><span className="pq-group-label">TDS</span>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                            <div className="vlpay-attachment">
                                <span className="pq-group-label">Attachment</span>
                                {p.attachmentUrl ? <ViewAttachmentLink url={p.attachmentUrl} className="cursor edit-action" style={{ textDecoration: 'none' }}>View</ViewAttachmentLink> : <p style={{ margin: 0 }}>-</p>}
                            </div>
                            <div className="action-buttons vlpay-actions">
                                <button type="button" onClick={() => setConfirmPayment(p)} className="pq-btn-ghost-danger" title="Remove payment" aria-label="Remove payment">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {paymentModalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay vlpay-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal vlpay-modal">
                        <div className="vlpay-modal-header">
                            <h2>{paymentForm.isRefund ? 'Add Refund' : 'Add Payment'}</h2>
                        </div>
                        <div className="vlpay-modal-body">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 16px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={paymentForm.isRefund} onChange={e => setPaymentForm(p => ({ ...p, isRefund: e.target.checked }))} />
                                This is a refund — the vendor paid us back (not the company paying the vendor)
                            </label>
                            <form id="vendor-payment-form" onSubmit={submitPayment}>
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
                                        <SettingSelectField settingType="payment_mode" options={paymentModes.map(m => ({ _id: m, name: m }))}
                                            value={paymentForm.paymentMode} onChange={v => setPaymentForm(p => ({ ...p, paymentMode: v }))} placeholder="e.g. Cash, Bank Transfer, UPI…" />
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
                            </form>
                        </div>
                        <div className="edit-modal-actions vlpay-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setPaymentModalOpen(false)}>Cancel</button>
                            <button type="submit" form="vendor-payment-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : (paymentForm.isRefund ? 'Save Refund' : 'Save Payment')}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmPayment && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmPayment(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this {confirmPayment.isRefund ? 'refund' : 'payment'}?</h3>
                        <p className="bin-confirm-name">₹{confirmPayment.amount.toLocaleString('en-IN')}</p>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmPayment(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmRemovePayment} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default VendorLedgerView;
