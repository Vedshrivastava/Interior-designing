import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import StyledDatePicker from './StyledDatePicker';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '' };
const thisMonth = () => new Date().toISOString().slice(0, 7);

/*
 * Standalone salary-payment entry + history — the same financeSalaryPayment
 * data as Masters' Salary Ledger tab, reachable from the Payments page
 * directly without pulling in the expected-vs-paid breakdown. Requires
 * picking an employee and a pay month first.
 */
const SalaryPaymentsManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [employeeId, setEmployeeId] = useState('');
    const [month, setMonth] = useState(thisMonth());
    const [bankAccounts, setBankAccounts] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader).then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/salary-payments/list`, { ...authHeader, params: { employeeId, month } });
            if (res.data.success) setPayments(res.data.data);
        } catch { toast.error('Error fetching salary payments'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (employeeId) fetchPayments(); else setPayments([]); }, [employeeId, month]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!employeeId) return toast.error('Select an employee');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/salary-payments/add`, { ...form, employeeId, month }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); await fetchPayments(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording salary payment'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/salary-payments/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchPayments(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing salary payment'); }
    };

    return (
        <div>
            <div className="wizard-field-grid" style={{ marginBottom: '20px' }}>
                <div className="add-product-name flex-col">
                    <p>Employee</p>
                    <QuickAddPicker url={url} resourceKey="employees" value={employeeId} onChange={setEmployeeId} placeholder="Select employee…" />
                </div>
                <div className="add-product-name flex-col">
                    <p>Month</p>
                    <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
                </div>
            </div>

            {!employeeId ? (
                <div className="admin-empty-state"><p>Select an employee to record or view salary payments.</p></div>
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
                                <p>Bank Account</p>
                                <select value={form.bankAccountId} onChange={e => setField('bankAccountId', e.target.value)}>
                                    <option value="">Cash</option>
                                    {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.accountName} · {a.bankName}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="wizard-actions" style={{ marginTop: '16px' }}>
                            <span />
                            <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : '+ Add Payment'}</button>
                        </div>
                    </form>

                    <div className="list-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                            <b>Date</b><b>Amount</b><b>Mode</b><b>Account</b><b>Action</b>
                        </div>
                        {loading ? (
                            <div className="admin-empty-state"><p>Loading…</p></div>
                        ) : payments.length === 0 ? (
                            <div className="admin-empty-state"><p>No payments for {month} yet.</p></div>
                        ) : (
                            payments.map(p => (
                                <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                                    <p>{new Date(p.date).toLocaleDateString()}</p>
                                    <p>₹{p.amount.toLocaleString('en-IN')}</p>
                                    <p>{p.paymentMode || '-'}</p>
                                    <p>{p.bankAccountId?.accountName || 'Cash'}</p>
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

export default SalaryPaymentsManager;
