import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { month: '', amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '' };
const thisMonth = () => new Date().toISOString().slice(0, 7);

/*
 * Salary Ledger for one employee — expected salary vs. paid, per month,
 * plus the add/remove payment form. Balance Due = employee.salary −
 * SUM(payments for that month), computed fresh on every call — see
 * controllers/financeSalaryLedger.js.
 */
const SalaryLedgerView = ({ url, employeeId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [ledger, setLedger] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [form, setForm] = useState({ ...emptyForm, month: thisMonth() });
    const [saving, setSaving] = useState(false);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/employees/${employeeId}/salary-ledger`, authHeader);
            if (res.data.success) setLedger(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching salary ledger'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (employeeId) fetchLedger(); }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async () => {
        if (!/^\d{4}-\d{2}$/.test(form.month)) return toast.error('A valid month is required');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/salary-payments/add`, { ...form, employeeId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm({ ...emptyForm, month: thisMonth() }); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording salary payment'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/salary-payments/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchLedger(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing salary payment'); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!ledger) return <div className="admin-empty-state"><p>Unable to load salary ledger.</p></div>;

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>Expected salary: ₹{ledger.expectedSalary.toLocaleString('en-IN')}/month</p>

            <div className="wizard-step-body">
                <p className="wizard-section-label">Add Payment</p>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Month *</p>
                        <input type="month" value={form.month} onChange={e => setField('month', e.target.value)} />
                    </div>
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
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px', marginBottom: '12px' }}>
                    <span />
                    <button type="button" className="add-btn" disabled={saving} onClick={submit}>{saving ? 'Saving…' : '+ Add Payment'}</button>
                </div>
            </div>

            <h3 style={{ margin: '20px 0 8px' }}>By Month</h3>
            <div className="list-table" style={{ marginBottom: '24px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <b>Month</b><b>Expected</b><b>Paid</b><b>Balance Due</b>
                </div>
                {ledger.months.length === 0 ? (
                    <div className="admin-empty-state"><p>No salary payments yet.</p></div>
                ) : ledger.months.map(m => (
                    <div key={m.month} className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                        <p>{m.month}</p>
                        <p>₹{m.expectedSalary.toLocaleString('en-IN')}</p>
                        <p>₹{m.paid.toLocaleString('en-IN')}</p>
                        <p style={{ fontWeight: 600, color: m.balanceDue > 0 ? '#c0392b' : 'var(--moss)' }}>₹{m.balanceDue.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>

            <h3 style={{ marginBottom: '8px' }}>Payment History</h3>
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                    <b>Month</b><b>Date</b><b>Amount</b><b>Account</b><b>Action</b>
                </div>
                {ledger.payments.length === 0 ? (
                    <div className="admin-empty-state"><p>No payments recorded yet.</p></div>
                ) : ledger.payments.map(p => (
                    <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 100px' }}>
                        <p>{p.month}</p>
                        <p>{new Date(p.date).toLocaleDateString()}</p>
                        <p>₹{p.amount.toLocaleString('en-IN')}</p>
                        <p>{p.bankAccountId?.accountName || 'Cash'}</p>
                        <div className="action-buttons"><p onClick={() => remove(p._id)} className="cursor delete-action">X</p></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SalaryLedgerView;
