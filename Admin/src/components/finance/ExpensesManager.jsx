import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const emptyForm = { expenseCategory: '', projectId: '', amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', notes: '' };
const emptySettleForm = { amount: '', date: '', paymentMode: '', bankAccountId: '' };

/*
 * General company/site expenses. Two ways an expense's cash side can play
 * out, both supported by the same form:
 *   - Paid now (default) — exactly the original behavior: amount + payment
 *     info recorded together, a cash/bank entry fires immediately.
 *   - Record as pending — amount is logged as accrued with no payment info
 *     at all; it shows a balance until settled (partially or fully) via one
 *     or more financeExpensePayment rows, added through the Settle action.
 * Reused as-is on both Payments' Miscellaneous tab and Payables' Other
 * Expenses tab.
 */
const ExpensesManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [categories, setCategories] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState(emptyForm);
    const [paidNow, setPaidNow] = useState(true);
    const [saving, setSaving] = useState(false);

    const [settleTarget, setSettleTarget] = useState(null);
    const [settleForm, setSettleForm] = useState(emptySettleForm);
    const [settling, setSettling] = useState(false);
    const [payments, setPayments] = useState([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/expenses/list`, authHeader);
            if (res.data.success) setExpenses(res.data.data);
        } catch { toast.error('Error fetching expenses'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchExpenses(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'expense_category' } })
            .then(res => { if (res.data.success) setCategories(res.data.data.map(s => s.name)); }).catch(() => {});
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader).then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const payload = paidNow ? form : { ...form, paymentMode: '', bankOrCashLabel: '', bankAccountId: '' };
            const res = await axios.post(`${url}/api/finance/expenses/add`, payload, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setPaidNow(true); await fetchExpenses(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording expense'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/expenses/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchExpenses(); }
            else toast.error(res.data.message || 'Error removing expense');
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing expense'); }
    };

    const openSettle = async (expense) => {
        setSettleTarget(expense);
        setSettleForm({ ...emptySettleForm, amount: expense.balance });
        setPaymentsLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/expense-payments/list`, { ...authHeader, params: { expenseId: expense._id } });
            if (res.data.success) setPayments(res.data.data);
        } catch { /* history just stays empty */ }
        finally { setPaymentsLoading(false); }
    };
    const closeSettle = () => { setSettleTarget(null); setPayments([]); };
    const setSettleField = (key, value) => setSettleForm(prev => ({ ...prev, [key]: value }));

    const submitSettle = async (e) => {
        e.preventDefault();
        if (!settleForm.amount || Number(settleForm.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!settleForm.date) return toast.error('Date is required');
        setSettling(true);
        try {
            const res = await axios.post(`${url}/api/finance/expense-payments/add`,
                { ...settleForm, expenseId: settleTarget._id }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                await fetchExpenses();
                await openSettle({ ...settleTarget, balance: settleTarget.balance - Number(settleForm.amount) });
                setSettleForm(emptySettleForm);
            } else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording payment'); }
        finally { setSettling(false); }
    };

    const statusFor = (e) => {
        if (e.balance <= 0) return { label: 'Paid', color: 'var(--moss)' };
        if (e.paidAmount > 0) return { label: 'Partially Paid', color: '#b8860b' };
        return { label: 'Pending', color: '#c0392b' };
    };

    return (
        <div>
            <form onSubmit={submit} style={{ marginBottom: '24px' }}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Category</p>
                        <input type="text" list="expense-category-options" value={form.expenseCategory} onChange={e => setField('expenseCategory', e.target.value)} />
                        <datalist id="expense-category-options">
                            {categories.map(c => <option key={c} value={c} />)}
                        </datalist>
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Project (optional — general overhead if blank)</p>
                        <select value={form.projectId} onChange={e => setField('projectId', e.target.value)}>
                            <option value="">General / overhead</option>
                            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </select>
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
                        <p>Payment Status</p>
                        <select value={paidNow ? 'paid' : 'pending'} onChange={e => setPaidNow(e.target.value === 'paid')}>
                            <option value="paid">Paid now</option>
                            <option value="pending">Record as pending — settle later</option>
                        </select>
                    </div>
                    {paidNow && (
                        <div className="add-product-name flex-col">
                            <p>Bank Account (leave blank if cash)</p>
                            <select value={form.bankAccountId} onChange={e => setField('bankAccountId', e.target.value)}>
                                <option value="">— Cash —</option>
                                {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.accountName} — {a.bankName}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="add-product-name flex-col wizard-field-full">
                        <p>Notes</p>
                        <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Record Expense'}</button>
                </div>
            </form>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr 1fr 1fr 1fr 140px' }}>
                    <b>Date</b><b>Category</b><b>Project</b><b>Amount</b><b>Paid</b><b>Status</b><b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : expenses.length === 0 ? (
                    <div className="admin-empty-state"><p>No expenses recorded yet.</p></div>
                ) : (
                    expenses.map(e => {
                        const status = statusFor(e);
                        return (
                            <div key={e._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr 1fr 1fr 1fr 140px' }}>
                                <p>{new Date(e.date).toLocaleDateString()}</p>
                                <p>{e.expenseCategory || '—'}</p>
                                <p>{e.projectId?.name || 'General'}</p>
                                <p>₹{e.amount.toLocaleString('en-IN')}</p>
                                <p>₹{e.paidAmount.toLocaleString('en-IN')}</p>
                                <p><span className="item-category" style={{ color: status.color }}>{status.label}</span></p>
                                <div className="action-buttons">
                                    {e.balance > 0 && <p onClick={() => openSettle(e)} className="cursor edit-action">Settle</p>}
                                    <p onClick={() => remove(e._id)} className="cursor delete-action">X</p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {settleTarget && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Settle Expense — {settleTarget.expenseCategory || 'General'}</h2>
                        <p style={{ marginBottom: '12px' }}>
                            Amount ₹{settleTarget.amount.toLocaleString('en-IN')} · Paid ₹{settleTarget.paidAmount?.toLocaleString('en-IN') ?? '0'} · Balance ₹{settleTarget.balance.toLocaleString('en-IN')}
                        </p>

                        {paymentsLoading ? (
                            <div className="admin-empty-state"><p>Loading…</p></div>
                        ) : payments.length > 0 && (
                            <div className="list-table" style={{ marginBottom: '16px' }}>
                                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                    <b>Date</b><b>Amount</b><b>Mode</b>
                                </div>
                                {payments.map(p => (
                                    <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                        <p>{new Date(p.date).toLocaleDateString()}</p>
                                        <p>₹{p.amount.toLocaleString('en-IN')}</p>
                                        <p>{p.bankAccountId?.accountName || 'Cash'}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <form className="flex-col" onSubmit={submitSettle}>
                            <div className="add-product-name flex-col">
                                <p>Payment Amount (₹) *</p>
                                <input type="number" value={settleForm.amount} onChange={e => setSettleField('amount', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Date *</p>
                                <input type="date" value={settleForm.date} onChange={e => setSettleField('date', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Bank Account (leave blank if cash)</p>
                                <select value={settleForm.bankAccountId} onChange={e => setSettleField('bankAccountId', e.target.value)}>
                                    <option value="">— Cash —</option>
                                    {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.accountName} — {a.bankName}</option>)}
                                </select>
                            </div>
                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={closeSettle}>Close</button>
                                <button type="submit" className="add-btn" disabled={settling}>{settling ? 'Saving…' : '+ Add Payment'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ExpensesManager;
