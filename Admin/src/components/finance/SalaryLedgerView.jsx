import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { month: '', amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '' };
const thisMonth = () => new Date().toISOString().slice(0, 7);

// See ContractorLedgerView.jsx's identical helper. Manual pick here — no
// work-type derivation, an employee doesn't have one.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const calcTds = (rate, amount) => (rate != null && amount ? round2((rate / 100) * Number(amount)) : '');

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
    const [tdsSections, setTdsSections] = useState([]);
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

    // A payment for this employee recorded elsewhere (the standalone
    // Salary Payment tab) wouldn't otherwise show up here until reselected.
    useFinanceWsRefresh(['financeSalaryPaymentsChanged'], (msg) => { if (employeeId && (!msg.employeeId || msg.employeeId === employeeId)) fetchLedger(); });
    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
            .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const onChangeAmount = (amount) => {
        setForm(p => {
            const section = tdsSections.find(s => s._id === p.tdsSectionId);
            return { ...p, amount, tdsAmount: p.tdsSectionId ? calcTds(section?.rate, amount) : p.tdsAmount };
        });
    };
    const onChangeTdsSection = (tdsSectionId) => {
        setForm(p => {
            const section = tdsSections.find(s => s._id === tdsSectionId);
            return { ...p, tdsSectionId, tdsAmount: tdsSectionId ? calcTds(section?.rate, p.amount) : '' };
        });
    };

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
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>
                Expected salary: ₹{ledger.expectedSalary.toLocaleString('en-IN')}/month
                {ledger.tdsTotal > 0 && ` · Total TDS withheld to date: ₹${ledger.tdsTotal.toLocaleString('en-IN')} (already included in Paid below, not cash in hand).`}
            </p>

            <div className="wizard-step-body">
                <p className="wizard-section-label">Add Payment</p>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Month *</p>
                        <input type="month" value={form.month} onChange={e => setField('month', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Amount (₹) *</p>
                        <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.amount} onChange={e => onChangeAmount(e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Date *</p>
                        <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Bank Account</p>
                        <StyledSelect
                            value={form.bankAccountId} onChange={v => setField('bankAccountId', v)} placeholder="Cash"
                            options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                        />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>TDS Section</p>
                        <StyledSelect
                            value={form.tdsSectionId} onChange={onChangeTdsSection} placeholder="No TDS"
                            options={tdsSections.map(s => ({ value: s._id, label: `${s.name}${s.rate != null ? ` (${s.rate}%)` : ''}` }))}
                        />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>TDS Amount</p>
                        <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.tdsAmount} onChange={e => setField('tdsAmount', e.target.value)} />
                    </div>
                </div>
                {form.amount > 0 && (
                    <p className="admin-subtitle" style={{ margin: '8px 0 0' }}>
                        Gross: ₹{Number(form.amount).toLocaleString('en-IN')}
                        {form.tdsAmount > 0 && ` · TDS: ₹${Number(form.tdsAmount).toLocaleString('en-IN')} · Net Payable: ₹${(Number(form.amount) - Number(form.tdsAmount)).toLocaleString('en-IN')}`}
                    </p>
                )}
                <div className="wizard-actions" style={{ marginTop: '16px', marginBottom: '12px' }}>
                    <span />
                    <button type="button" className="add-btn" disabled={saving} onClick={submit}>{saving ? 'Saving…' : '+ Add Payment'}</button>
                </div>
            </div>

            <h3 style={{ margin: '20px 0 8px' }}>By Month</h3>
            <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
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
            <div className="list-table finance-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 100px' }}>
                    <b>Month</b><b>Date</b><b>Amount</b><b>Account</b><b>TDS</b><b>Action</b>
                </div>
                {ledger.payments.length === 0 ? (
                    <div className="admin-empty-state"><p>No payments recorded yet.</p></div>
                ) : ledger.payments.map(p => (
                    <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 100px' }}>
                        <p>{p.month}</p>
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

export default SalaryLedgerView;
