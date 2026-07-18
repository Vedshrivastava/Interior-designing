import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '' };

/*
 * Commission Ledger for one referral vendor — earnings breakdown (from
 * financeWork × referralRatePerSqft across the projects they referred),
 * payment form/history, and the computed Commission Payable. Mirrors
 * ContractorLedgerView/VendorLedgerView's shape. Only meaningful for
 * vendorType 'referral' — the picker calling this filters to that type.
 */
const CommissionLedgerView = ({ url, vendorId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [ledger, setLedger] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/vendors/${vendorId}/commission-ledger`, authHeader);
            if (res.data.success) setLedger(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching commission ledger'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (vendorId) fetchLedger(); }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps
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
            const res = await axios.post(`${url}/api/finance/commission-payments/add`, { ...form, vendorId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); await fetchLedger(); }
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
            <div className="list-table" style={{ marginBottom: '28px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <b>Commission Earned</b><b>Payments</b><b>Commission Payable</b>
                </div>
                <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <p>₹{totals.earnings.toLocaleString('en-IN')}</p>
                    <p>₹{totals.payments.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 700, color: totals.commissionPayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{totals.commissionPayable.toLocaleString('en-IN')}</p>
                </div>
            </div>

            <h3 style={{ marginBottom: '8px' }}>Earnings by Work</h3>
            <div className="list-table" style={{ marginBottom: '28px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr' }}>
                    <b>Project</b><b>Work Type</b><b>Completed Area</b><b>Referral Rate</b><b>Earnings</b>
                </div>
                {ledger.works.length === 0 ? (
                    <div className="admin-empty-state"><p>No referred works yet.</p></div>
                ) : ledger.works.map(w => (
                    <div key={w._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr' }}>
                        <p>{w.projectName}</p>
                        <p>{w.workType}</p>
                        <p>{w.completedAreaSqft} sqft</p>
                        <p>{w.referralRatePerSqft != null ? `₹${w.referralRatePerSqft}/sqft` : <span title="No matching work type rate configured">(no rate)</span>}</p>
                        <p>₹{w.earnings.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>

            <h3 style={{ marginBottom: '8px' }}>Payments</h3>
            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Amount (₹) *</p>
                        <input type="number" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Date *</p>
                        <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
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
                        <input type="number" value={form.tdsAmount} onChange={e => setField('tdsAmount', e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px', marginBottom: '12px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : '+ Add Payment'}</button>
                </div>
            </form>
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                    <b>Date</b><b>Amount</b><b>Account</b><b>TDS</b><b>Action</b>
                </div>
                {ledger.payments.length === 0 ? (
                    <div className="admin-empty-state"><p>No payments yet.</p></div>
                ) : ledger.payments.map(p => (
                    <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                        <p>{new Date(p.date).toLocaleDateString()}</p>
                        <p>₹{p.amount.toLocaleString('en-IN')}</p>
                        <p>{p.bankAccountId?.accountName || 'Cash'}</p>
                        <p>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                        <div className="action-buttons"><p onClick={() => remove(p._id)} className="cursor delete-action">X</p></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CommissionLedgerView;
