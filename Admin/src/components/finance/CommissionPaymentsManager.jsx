import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '' };

/*
 * Standalone commission-payment entry + history — the same
 * financeCommissionPayment data as Procurement's Commission Ledger tab,
 * reachable from the Payments page directly without pulling in the
 * earnings breakdown. Scoped to referral-type vendors only.
 */
const CommissionPaymentsManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [vendors, setVendors] = useState([]);
    const [vendorId, setVendorId] = useState('');
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/vendors/list`, authHeader)
            .then(res => { if (res.data.success) setVendors(res.data.data.filter(v => v.vendorType === 'referral')); })
            .catch(() => {});
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
            .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/commission-payments/list`, { ...authHeader, params: { vendorId } });
            if (res.data.success) setPayments(res.data.data);
        } catch { toast.error('Error fetching commission payments'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (vendorId) fetchPayments(); else setPayments([]); }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!vendorId) return toast.error('Select a referral vendor');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/commission-payments/add`, { ...form, vendorId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); await fetchPayments(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording commission payment'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/commission-payments/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchPayments(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing commission payment'); }
    };

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Referral Vendor</p>
                <select value={vendorId} onChange={e => setVendorId(e.target.value)}>
                    <option value="">Select referral vendor…</option>
                    {vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                </select>
            </div>

            {!vendorId ? (
                <div className="admin-empty-state"><p>Select a referral vendor to record or view commission payments.</p></div>
            ) : (
                <>
                    <form onSubmit={submit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        <input type="number" placeholder="Amount" value={form.amount} onChange={e => setField('amount', e.target.value)} style={{ flex: 1, minWidth: '100px' }} />
                        <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} style={{ flex: 1, minWidth: '140px' }} />
                        <select value={form.bankAccountId} onChange={e => setField('bankAccountId', e.target.value)} style={{ flex: 1, minWidth: '160px' }}>
                            <option value="">— Cash —</option>
                            {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.accountName} — {a.bankName}</option>)}
                        </select>
                        <select value={form.tdsSectionId} onChange={e => setField('tdsSectionId', e.target.value)} style={{ flex: 1, minWidth: '160px' }}>
                            <option value="">— No TDS —</option>
                            {tdsSections.map(s => <option key={s._id} value={s._id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                        </select>
                        <input type="number" placeholder="TDS amount (optional)" value={form.tdsAmount} onChange={e => setField('tdsAmount', e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
                        <button type="submit" className="add-point-btn" disabled={saving}>{saving ? 'Saving…' : '+ Add Payment'}</button>
                    </form>

                    <div className="list-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                            <b>Date</b><b>Amount</b><b>Account</b><b>TDS</b><b>Action</b>
                        </div>
                        {loading ? (
                            <div className="admin-empty-state"><p>Loading…</p></div>
                        ) : payments.length === 0 ? (
                            <div className="admin-empty-state"><p>No payments recorded yet.</p></div>
                        ) : (
                            payments.map(p => (
                                <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                                    <p>{new Date(p.date).toLocaleDateString()}</p>
                                    <p>₹{p.amount.toLocaleString('en-IN')}</p>
                                    <p>{p.bankAccountId?.accountName || 'Cash'}</p>
                                    <p>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '—'}</p>
                                    <div className="action-buttons"><p onClick={() => remove(p._id)} className="cursor delete-action">X</p></div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default CommissionPaymentsManager;
