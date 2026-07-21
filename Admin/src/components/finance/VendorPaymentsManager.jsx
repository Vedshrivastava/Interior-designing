import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import StyledDatePicker from './StyledDatePicker';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '' };

/*
 * Standalone vendor-payment entry + history — the same financeVendorPayment
 * data as the Payments section inside VendorLedgerView, reachable from the
 * Payments page directly without pulling in the rest of the ledger
 * (purchases/returns). Scoped to non-contractor vendors — labour
 * contractors are paid through the Contractor Payment tab instead.
 */
const VendorPaymentsManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [vendorId, setVendorId] = useState('');
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState(emptyForm);
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
            .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/vendor-payments/list`, { ...authHeader, params: { vendorId } });
            if (res.data.success) setPayments(res.data.data);
        } catch { toast.error('Error fetching payments'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (vendorId) fetchPayments(); else setPayments([]); }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!vendorId) return toast.error('Select a vendor');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');

        setSaving(true);
        try {
            const data = new FormData();
            Object.entries(form).forEach(([k, v]) => data.append(k, v));
            data.append('vendorId', vendorId);
            if (file) data.append('attachment', file);
            const res = await axios.post(`${url}/api/finance/vendor-payments/add`, data, {
                headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setFile(null); await fetchPayments(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording payment'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/vendor-payments/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchPayments(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing payment'); }
    };

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
                <p>Vendor</p>
                <QuickAddPicker url={url} resourceKey="vendors" value={vendorId} onChange={setVendorId}
                    filter={v => v.vendorType !== 'labour_contractor'} placeholder="Select vendor…" />
            </div>

            {!vendorId ? (
                <div className="admin-empty-state"><p>Select a vendor to record or view payments.</p></div>
            ) : (
                <>
                    <form onSubmit={submit}>
                        <div className="wizard-field-grid">
                            <div className="add-product-name flex-col">
                                <p>Amount (₹) *</p>
                                <input type="number" onWheel={e => e.target.blur()} min="0" value={form.amount} onChange={e => setField('amount', e.target.value)} />
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
                                <input type="number" onWheel={e => e.target.blur()} min="0" value={form.tdsAmount} onChange={e => setField('tdsAmount', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Attachment</p>
                                <input type="file" onChange={e => setFile(e.target.files[0] || null)} />
                            </div>
                            <div className="add-product-name flex-col wizard-field-full">
                                <p>Bank / Cash Label (legacy, optional)</p>
                                <input type="text" value={form.bankOrCashLabel} onChange={e => setField('bankOrCashLabel', e.target.value)} />
                            </div>
                        </div>
                        <div className="wizard-actions" style={{ marginTop: '16px' }}>
                            <span />
                            <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : '+ Add Payment'}</button>
                        </div>
                    </form>

                    <div className="list-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 100px' }}>
                            <b>Date</b><b>Amount</b><b>Mode</b><b>Account</b><b>TDS</b><b>Attachment</b><b>Action</b>
                        </div>
                        {loading ? (
                            <div className="admin-empty-state"><p>Loading…</p></div>
                        ) : payments.length === 0 ? (
                            <div className="admin-empty-state"><p>No payments recorded yet.</p></div>
                        ) : (
                            payments.map(p => (
                                <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 100px' }}>
                                    <p>{new Date(p.date).toLocaleDateString()}</p>
                                    <p>₹{p.amount.toLocaleString('en-IN')}</p>
                                    <p>{p.paymentMode || '-'}</p>
                                    <p>{p.bankAccountId?.accountName || 'Cash'}</p>
                                    <p>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                                    <p>{p.attachmentUrl ? <a href={p.attachmentUrl} target="_blank" rel="noreferrer">View</a> : '-'}</p>
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

export default VendorPaymentsManager;
