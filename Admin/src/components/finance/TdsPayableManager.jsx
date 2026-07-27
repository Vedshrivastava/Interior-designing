import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import { KpiCard, KpiGrid, formatINR } from './DashboardWidgets';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', tdsSectionId: '', challanNumber: '', bankAccountId: '', notes: '' };

/*
 * TDS withheld from every contractor/vendor/salary/labour/commission/
 * labour-provider payment ever made is money owed to the tax department,
 * not the payee — this is that running balance (withheld minus actually
 * deposited), company-wide, with a form to record each real deposit made.
 * Mirrors the Vendor/Contractor Payables shape: computed fresh, never
 * stored, a deposit is a real cash-out event just like any other payment.
 */
const TdsPayableManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [summary, setSummary] = useState(null);
    const [deposits, setDeposits] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [summaryRes, depositsRes] = await Promise.all([
                axios.get(`${url}/api/finance/reports/tds-payable`, authHeader),
                axios.get(`${url}/api/finance/tds-deposits/list`, authHeader),
            ]);
            if (summaryRes.data.success) setSummary(summaryRes.data.data);
            if (depositsRes.data.success) setDeposits(depositsRes.data.data);
        } catch { toast.error('Error fetching TDS payable'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
            .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // Any payment carrying TDS (recorded from any Payments tab) or a
    // deposit recorded elsewhere changes this balance.
    useFinanceWsRefresh([
        'financeContractorLedgerChanged', 'financeVendorLedgerChanged', 'financeLabourLedgerChanged',
        'financeLabourProviderPaymentsChanged', 'financeTdsDepositsChanged',
    ], fetchAll);

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/tds-deposits/add`, form, authHeader);
            if (res.data.success) {
                toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchAll();
            } else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording TDS deposit'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/tds-deposits/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchAll(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing TDS deposit'); }
    };

    if (loading && !summary) return <div className="admin-empty-state"><p>Loading…</p></div>;

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                TDS withheld from contractor, vendor, salary, labour, commission, and labour-provider payments belongs to the tax department, not the payee — this tracks what's been withheld so far against what's actually been deposited.
            </p>

            <KpiGrid>
                <KpiCard label="TDS Withheld to Date" value={formatINR(summary?.totalWithheld)} />
                <KpiCard label="TDS Deposited to Date" value={formatINR(summary?.totalDeposited)} />
                <KpiCard label="TDS Payable" value={formatINR(summary?.payable)} tone={summary?.payable > 0 ? 'danger' : 'good'}
                    sub="What's still owed to the tax department right now" />
            </KpiGrid>

            {summary?.bySection.length > 0 && (
                <div className="list-table finance-table" style={{ margin: '24px 0' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                        <b>Section</b><b>Withheld</b><b>Deposited</b><b>Payable</b>
                    </div>
                    {summary.bySection.map(s => (
                        <div key={s.tdsSectionId || 'unspecified'} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                            <p>{s.tdsSectionName}{s.tdsSectionCode ? ` (${s.tdsSectionCode})` : ''}</p>
                            <p>{formatINR(s.withheld)}</p>
                            <p>{formatINR(s.deposited)}</p>
                            <p style={{ color: s.payable > 0 ? '#c0392b' : 'var(--moss)', fontWeight: 600 }}>{formatINR(s.payable)}</p>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 8px' }}>
                <h3 style={{ margin: 0 }}>Deposits Made</h3>
                <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Deposit</button>
            </div>
            {deposits.length === 0 ? (
                <div className="admin-empty-state"><p>No TDS deposits recorded yet.</p></div>
            ) : (
                <div className="list-table finance-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1.2fr 1fr 1fr 1fr 100px' }}>
                        <b>Date</b><b>Amount</b><b>Section</b><b>Challan #</b><b>Account</b><b>Notes</b><b>Action</b>
                    </div>
                    {deposits.map(d => (
                        <div key={d._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1.2fr 1fr 1fr 1fr 100px' }}>
                            <p>{new Date(d.date).toLocaleDateString()}</p>
                            <p>₹{d.amount.toLocaleString('en-IN')}</p>
                            <p>{d.tdsSectionId ? `${d.tdsSectionId.name}${d.tdsSectionId.code ? ` (${d.tdsSectionId.code})` : ''}` : 'All sections'}</p>
                            <p>{d.challanNumber || '-'}</p>
                            <p>{d.bankAccountId?.accountName || 'Cash'}</p>
                            <p>{d.notes || '-'}</p>
                            <div className="action-buttons"><p onClick={() => remove(d._id)} className="cursor delete-action">X</p></div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Add TDS Deposit</h2>
                        <p className="admin-subtitle" style={{ marginTop: '-20px', marginBottom: '20px' }}>
                            TDS Payable: <span style={{ fontWeight: 700, color: summary?.payable > 0 ? '#c0392b' : 'var(--moss)' }}>{formatINR(summary?.payable)}</span>
                        </p>
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
                                    <p>TDS Section (optional)</p>
                                    <StyledSelect
                                        value={form.tdsSectionId} onChange={v => setField('tdsSectionId', v)} placeholder="All sections (lump sum)"
                                        options={tdsSections.map(s => ({ value: s._id, label: `${s.name}${s.code ? ` (${s.code})` : ''}` }))}
                                    />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Bank Account</p>
                                    <StyledSelect
                                        value={form.bankAccountId} onChange={v => setField('bankAccountId', v)} placeholder="Cash"
                                        options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                                    />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Challan Number</p>
                                    <input type="text" value={form.challanNumber} onChange={e => setField('challanNumber', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Notes</p>
                                    <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
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
        </div>
    );
};

export default TdsPayableManager;
