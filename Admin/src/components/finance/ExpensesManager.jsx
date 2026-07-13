import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const emptyForm = { expenseCategory: '', projectId: '', amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', notes: '' };

/*
 * General company/site expenses — a straightforward paid-when-entered log,
 * not an earned-vs-paid ledger like Salary/Commission/Vendor/Contractor.
 * Reused as-is on both Payments' Miscellaneous tab and Payables' Other
 * Expenses tab — there's no separate "balance" view to build for Payables
 * here, just the same log.
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
    const [saving, setSaving] = useState(false);

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
            const res = await axios.post(`${url}/api/finance/expenses/add`, form, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); await fetchExpenses(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording expense'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/expenses/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchExpenses(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing expense'); }
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
                        <p>Bank Account (leave blank if cash)</p>
                        <select value={form.bankAccountId} onChange={e => setField('bankAccountId', e.target.value)}>
                            <option value="">— Cash —</option>
                            {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.accountName} — {a.bankName}</option>)}
                        </select>
                    </div>
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
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr 1fr 1fr 100px' }}>
                    <b>Date</b><b>Category</b><b>Project</b><b>Amount</b><b>Account</b><b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : expenses.length === 0 ? (
                    <div className="admin-empty-state"><p>No expenses recorded yet.</p></div>
                ) : (
                    expenses.map(e => (
                        <div key={e._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr 1fr 1fr 100px' }}>
                            <p>{new Date(e.date).toLocaleDateString()}</p>
                            <p>{e.expenseCategory || '—'}</p>
                            <p>{e.projectId?.name || 'General'}</p>
                            <p>₹{e.amount.toLocaleString('en-IN')}</p>
                            <p>{e.bankAccountId?.accountName || 'Cash'}</p>
                            <div className="action-buttons"><p onClick={() => remove(e._id)} className="cursor delete-action">X</p></div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ExpensesManager;
