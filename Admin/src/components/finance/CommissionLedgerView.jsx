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
 * Commission Ledger for one referral — earnings breakdown (from
 * financeWork × referralRatePerSqft across the projects they referred),
 * payment form/history, and the computed Commission Payable. Mirrors
 * ContractorLedgerView/VendorLedgerView's shape. A referral is its own
 * collection (financeReferral), not a vendor.
 */
const CommissionLedgerView = ({ url, referralId }) => {
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
            const res = await axios.get(`${url}/api/finance/referrals/${referralId}/commission-ledger`, authHeader);
            if (res.data.success) setLedger(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching commission ledger'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (referralId) fetchLedger(); }, [referralId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment for this referral recorded elsewhere (the standalone
    // Commission Payment tab) wouldn't otherwise show up here until reselected.
    useFinanceWsRefresh(['financeCommissionPaymentsChanged'], (msg) => { if (referralId && (!msg.referralId || msg.referralId === referralId)) fetchLedger(); });
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
            const res = await axios.post(`${url}/api/finance/commission-payments/add`, { ...form, referralId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording commission payment'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/commission-payments/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing commission payment'); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!ledger) return <div className="admin-empty-state"><p>Unable to load commission ledger.</p></div>;

    const { totals } = ledger;

    return (
        <div>
            <div className="list-table finance-table" style={{ marginBottom: '8px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                    <b>Total (All Logged)</b><b>Approved (Reviewed)</b><b>Unapproved</b><b>Payments</b><b>Commission Payable</b>
                </div>
                <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                    <p>₹{totals.totalAmount.toLocaleString('en-IN')}</p>
                    <p style={{ color: totals.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}>{totals.earnings > 0 ? `₹${totals.earnings.toLocaleString('en-IN')}` : 'Unapproved'}</p>
                    <p style={{ color: totals.unapprovedAmount > 0 ? '#c0392b' : 'var(--text-lt)' }}>₹{totals.unapprovedAmount.toLocaleString('en-IN')}</p>
                    <p>₹{totals.payments.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 700, color: totals.commissionPayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{totals.commissionPayable.toLocaleString('en-IN')}</p>
                </div>
            </div>
            {totals.unapprovedAmount > 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                    ₹{totals.unapprovedAmount.toLocaleString('en-IN')} worth of referred work hasn't been reviewed yet; it isn't counted as Approved commission until it's reviewed (Payables/Receivables → Deductions).
                </p>
            )}

            <h3 style={{ marginBottom: '8px' }}>Earnings by Work</h3>
            <div className="list-table finance-table" style={{ marginBottom: '28px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.2fr 0.9fr 1fr 0.9fr 1fr 0.9fr' }}>
                    <b>Project</b><b>Work Type</b><b>Completed Area</b><b>Referral Cut</b><b>Approved</b><b>Unapproved</b>
                </div>
                {ledger.works.length === 0 ? (
                    <div className="admin-empty-state"><p>No referred works yet.</p></div>
                ) : ledger.works.map(w => (
                    <div key={w._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.2fr 0.9fr 1fr 0.9fr 1fr 0.9fr' }}>
                        <p>{w.projectName}</p>
                        <p>{w.workType}</p>
                        <p>{w.completedAreaSqft} sqft</p>
                        <p>{w.referralRatePerSqft != null ? `₹${w.referralRatePerSqft}/sqft` : <span title="No matching work type rate configured">(no rate)</span>}</p>
                        <p style={{ color: w.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}>
                            {w.earnings > 0
                                ? <>₹{w.earnings.toLocaleString('en-IN')} <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>({w.approvedAreaSqft} sqft{w.approvedDate ? `, ${new Date(w.approvedDate).toLocaleDateString()}` : ''})</span></>
                                : 'Unapproved'}
                        </p>
                        <p style={{ color: w.unapprovedAmount > 0 ? '#c0392b' : 'var(--text-lt)' }}>{w.referralRatePerSqft != null ? `₹${w.unapprovedAmount.toLocaleString('en-IN')}` : '-'}</p>
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

export default CommissionLedgerView;
