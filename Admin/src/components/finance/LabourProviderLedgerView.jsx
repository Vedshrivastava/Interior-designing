import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '' };

/*
 * Labour Provider Ledger for one provider — mirrors CommissionLedgerView's
 * shape (earnings breakdown + payment form/history + computed payable),
 * but a provider's "earnings" are split across every labourer connected
 * to them (financeLabourer.labourProviderId), per work, using each
 * labourer's OWN reviewed/approved sqft on that work
 * × the provider's fixed rate for that labourer — never derived from or
 * deducted against the labourer's own pay (see
 * controllers/financeLabourProviderLedger.js). Approved Pay and Pay Left
 * to Approve are kept as two separate figures throughout, per how the
 * cut is earned: only reviewed sqft is actually payable, but unreviewed
 * sqft's prospective pay still needs to be visible.
 */
const LabourProviderLedgerView = ({ url, labourProviderId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [ledger, setLedger] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/labour-providers/${labourProviderId}/labour-provider-ledger`, authHeader);
            if (res.data.success) setLedger(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching labour provider ledger'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (labourProviderId) fetchLedger(); }, [labourProviderId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment for this labour provider recorded elsewhere (the standalone
    // Labour Provider Payment tab) wouldn't otherwise show up here until
    // reselected.
    useFinanceWsRefresh(['financeLabourProviderPaymentsChanged'], (msg) => { if (labourProviderId && (!msg.labourProviderId || msg.labourProviderId === labourProviderId)) fetchLedger(); });
    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
            .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/labour-provider-payments/add`, { ...form, labourProviderId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording labour provider payment'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/labour-provider-payments/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing labour provider payment'); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!ledger) return <div className="admin-empty-state"><p>Unable to load labour provider ledger.</p></div>;

    const { totals } = ledger;

    return (
        <div>
            <div className="list-table finance-table" style={{ marginBottom: '28px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <b>Approved Pay</b><b>Pay Left to Approve</b><b>Total Pay Done</b><b>Total Pay Left</b>
                </div>
                <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <p>₹{totals.approvedPay.toLocaleString('en-IN')}</p>
                    <p>₹{totals.pendingApprovalPay.toLocaleString('en-IN')}</p>
                    <p>₹{totals.paymentsTotal.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 700, color: totals.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{totals.balancePayable.toLocaleString('en-IN')}</p>
                </div>
            </div>

            <h3 style={{ marginBottom: '8px' }}>Earnings by Labourer &amp; Work</h3>
            <div className="list-table finance-table" style={{ marginBottom: '28px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.1fr 1.1fr 0.9fr 0.8fr 0.8fr 0.8fr 0.7fr 0.9fr 0.9fr' }}>
                    <b>Labourer</b><b>Project</b><b>Work Type</b><b>Total Area</b><b>Approved</b><b>Pending</b><b>Rate</b><b>Approved Pay</b><b>Pending Pay</b>
                </div>
                {ledger.rows.length === 0 ? (
                    <div className="admin-empty-state"><p>No work logged by this provider's labourers yet.</p></div>
                ) : ledger.rows.map((r, i) => (
                    <div key={i} className="list-table-format row-item" style={{ gridTemplateColumns: '1.1fr 1.1fr 0.9fr 0.8fr 0.8fr 0.8fr 0.7fr 0.9fr 0.9fr' }}>
                        <p>{r.labourerName}</p>
                        <p>{r.projectName}</p>
                        <p>{r.workType}</p>
                        <p>{r.totalAreaSqft} sqft</p>
                        <p>{r.approvedAreaSqft} sqft</p>
                        <p>{r.unapprovedAreaSqft} sqft</p>
                        <p>₹{r.rate}/sqft</p>
                        <p>₹{r.approvedPay.toLocaleString('en-IN')}</p>
                        <p>₹{r.pendingPay.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0 }}>Payments</h3>
                <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Payment</button>
            </div>
            {ledger.payments.length === 0 ? (
                <div className="admin-empty-state"><p>No payments yet.</p></div>
            ) : (
                <div className="list-table finance-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 100px' }}>
                        <b>Date</b><b>Amount</b><b>Mode</b><b>Account</b><b>TDS</b><b>Action</b>
                    </div>
                    {ledger.payments.map(p => (
                        <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 100px' }}>
                            <p>{new Date(p.date).toLocaleDateString()}</p>
                            <p>₹{p.amount.toLocaleString('en-IN')}</p>
                            <p>{p.paymentMode || '-'}</p>
                            <p>{p.bankAccountId?.accountName || 'Cash'}</p>
                            <p>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                            <div className="action-buttons"><p onClick={() => remove(p._id)} className="cursor delete-action">X</p></div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Add Payment</h2>
                        <form onSubmit={submit}>
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
                                    <p>Payment Mode</p>
                                    <input type="text" value={form.paymentMode} onChange={e => setField('paymentMode', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Bank Account</p>
                                    <select value={form.bankAccountId} onChange={e => setField('bankAccountId', e.target.value)}>
                                        <option value="">Cash</option>
                                        {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.accountName} · {a.bankName}</option>)}
                                    </select>
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>TDS Section</p>
                                    <select value={form.tdsSectionId} onChange={e => setField('tdsSectionId', e.target.value)}>
                                        <option value="">No TDS</option>
                                        {tdsSections.map(s => <option key={s._id} value={s._id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                                    </select>
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>TDS Amount (optional)</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.tdsAmount} onChange={e => setField('tdsAmount', e.target.value)} />
                                </div>
                            </div>
                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
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

export default LabourProviderLedgerView;
