import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import StyledDatePicker from './StyledDatePicker';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '' };

/*
 * Standalone labour-provider payment entry + history — the same
 * financeLabourProviderPayment data as Labourers' Labour Provider Ledger
 * tab, reachable from the Payments page directly without pulling in the
 * earnings breakdown. Mirrors CommissionPaymentsManager exactly.
 */
const LabourProviderPaymentsManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [labourProviderId, setLabourProviderId] = useState('');
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
            .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/labour-provider-payments/list`, { ...authHeader, params: { labourProviderId } });
            if (res.data.success) setPayments(res.data.data);
        } catch { toast.error('Error fetching labour provider payments'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (labourProviderId) fetchPayments(); else setPayments([]); }, [labourProviderId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!labourProviderId) return toast.error('Select a labour provider');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/labour-provider-payments/add`, { ...form, labourProviderId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchPayments(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording labour provider payment'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/labour-provider-payments/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchPayments(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing labour provider payment'); }
    };

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
                <p>Labour Provider</p>
                <QuickAddPicker url={url} resourceKey="labourProviders" value={labourProviderId} onChange={setLabourProviderId}
                    placeholder="Select labour provider…" />
            </div>

            {!labourProviderId ? (
                <div className="admin-empty-state"><p>Select a labour provider to record or view payments.</p></div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0 }}>Payments</h3>
                        <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Payment</button>
                    </div>
                    {loading ? (
                        <div className="admin-empty-state"><p>Loading…</p></div>
                    ) : payments.length === 0 ? (
                        <div className="admin-empty-state"><p>No payments recorded yet.</p></div>
                    ) : (
                        <div className="list-table finance-table">
                            <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 100px' }}>
                                <b>Date</b><b>Amount</b><b>Mode</b><b>Account</b><b>TDS</b><b>Action</b>
                            </div>
                            {payments.map(p => (
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
                </>
            )}
        </div>
    );
};

export default LabourProviderPaymentsManager;
