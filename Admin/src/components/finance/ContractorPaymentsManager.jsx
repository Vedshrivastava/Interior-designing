import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', utrNumber: '', notes: '' };

/*
 * Standalone contractor-payment entry + history — the same
 * financeContractorPayment data as the Payments section inside
 * ContractorLedgerView, just reachable from the Payments page directly
 * without pulling in the rest of the ledger (earnings/advances/deductions).
 * Requires picking a contractor first, same picker pattern used elsewhere.
 */
const ContractorPaymentsManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [vendors, setVendors] = useState([]);
    const [vendorId, setVendorId] = useState('');
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState(emptyForm);
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/vendors/list`, authHeader)
            .then(res => { if (res.data.success) setVendors(res.data.data.filter(v => v.vendorType === 'labour_contractor')); })
            .catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/contractor-payments/list`, { ...authHeader, params: { vendorId } });
            if (res.data.success) setPayments(res.data.data);
        } catch { toast.error('Error fetching payments'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (vendorId) fetchPayments(); else setPayments([]); }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!vendorId) return toast.error('Select a contractor');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');

        setSaving(true);
        try {
            const data = new FormData();
            Object.entries(form).forEach(([k, v]) => data.append(k, v));
            data.append('vendorId', vendorId);
            if (file) data.append('attachment', file);
            const res = await axios.post(`${url}/api/finance/contractor-payments/add`, data, {
                headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setFile(null); await fetchPayments(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording payment'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/contractor-payments/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchPayments(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing payment'); }
    };

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Contractor</p>
                <select value={vendorId} onChange={e => setVendorId(e.target.value)}>
                    <option value="">Select contractor…</option>
                    {vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                </select>
            </div>

            {!vendorId ? (
                <div className="admin-empty-state"><p>Select a contractor to record or view payments.</p></div>
            ) : (
                <>
                    <form onSubmit={submit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        <input type="number" placeholder="Amount" value={form.amount} onChange={e => setField('amount', e.target.value)} style={{ flex: 1, minWidth: '100px' }} />
                        <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} style={{ flex: 1, minWidth: '140px' }} />
                        <input type="text" placeholder="Payment mode" value={form.paymentMode} onChange={e => setField('paymentMode', e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
                        <input type="text" placeholder="Bank / Cash label" value={form.bankOrCashLabel} onChange={e => setField('bankOrCashLabel', e.target.value)} style={{ flex: 1, minWidth: '140px' }} />
                        <input type="file" onChange={e => setFile(e.target.files[0] || null)} style={{ flex: 1, minWidth: '160px' }} />
                        <button type="submit" className="add-point-btn" disabled={saving}>{saving ? 'Saving…' : '+ Add Payment'}</button>
                    </form>

                    <div className="list-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                            <b>Date</b><b>Amount</b><b>Mode</b><b>Attachment</b><b>Action</b>
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
                                    <p>{p.paymentMode || '—'}</p>
                                    <p>{p.attachmentUrl ? <a href={p.attachmentUrl} target="_blank" rel="noreferrer">View</a> : '—'}</p>
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

export default ContractorPaymentsManager;
