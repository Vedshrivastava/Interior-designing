import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import { KpiCard, KpiGrid, formatINR } from './DashboardWidgets';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
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
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

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
        Promise.all([
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
                .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
                .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {}),
        ]).finally(() => setRefDataLoading(false));
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

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/tds-deposits/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchAll(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing TDS deposit'); }
        finally { setDeleting(false); }
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
                <div className="dash-chart-card tdsm-sec-card" style={{ margin: '24px 0' }}>
                    <div className="tdsm-sec-row tdsm-sec-header">
                        <b className="tdsm-sec-name">Section</b>
                        <b className="tdsm-sec-withheld">Withheld</b>
                        <b className="tdsm-sec-deposited">Deposited</b>
                        <b className="tdsm-sec-payable">Payable</b>
                    </div>
                    {summary.bySection.map(s => (
                        <div key={s.tdsSectionId || 'unspecified'} className="tdsm-sec-row">
                            <p className="tdsm-sec-name">{s.tdsSectionName}{s.tdsSectionCode ? ` (${s.tdsSectionCode})` : ''}</p>
                            <p className="tdsm-sec-withheld"><span className="pq-group-label">Withheld</span>{formatINR(s.withheld)}</p>
                            <p className="tdsm-sec-deposited"><span className="pq-group-label">Deposited</span>{formatINR(s.deposited)}</p>
                            <p className="tdsm-sec-payable" style={{ color: s.payable > 0 ? '#c0392b' : 'var(--moss)', fontWeight: 600 }}><span className="pq-group-label">Payable</span>{formatINR(s.payable)}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="pq-section-header" style={{ margin: '24px 0 8px' }}>
                <h3 style={{ margin: 0 }}>Deposits Made</h3>
                <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Deposit</button>
            </div>
            {deposits.length === 0 ? (
                <div className="admin-empty-state"><p>No TDS deposits recorded yet.</p></div>
            ) : (
                <div className="dash-chart-card tdsm-card">
                    <div className="tdsm-row tdsm-header">
                        <b className="tdsm-date">Date</b>
                        <b className="tdsm-amount">Amount</b>
                        <b className="tdsm-section">Section</b>
                        <b className="tdsm-challan">Challan #</b>
                        <b className="tdsm-account">Account</b>
                        <b className="tdsm-notes">Notes</b>
                        <b className="tdsm-action">Action</b>
                    </div>
                    {deposits.map(d => (
                        <div key={d._id} className="tdsm-row">
                            <p className="tdsm-date">{new Date(d.date).toLocaleDateString()}</p>
                            <p className="tdsm-amount"><span className="pq-group-label">Amount</span>₹{d.amount.toLocaleString('en-IN')}</p>
                            <p className="tdsm-section"><span className="pq-group-label">Section</span>{d.tdsSectionId ? `${d.tdsSectionId.name}${d.tdsSectionId.code ? ` (${d.tdsSectionId.code})` : ''}` : 'All sections'}</p>
                            <p className="tdsm-challan"><span className="pq-group-label">Challan #</span>{d.challanNumber || '-'}</p>
                            <p className="tdsm-account"><span className="pq-group-label">Account</span>{d.bankAccountId?.accountName || 'Cash'}</p>
                            <p className="tdsm-notes"><span className="pq-group-label">Notes</span>{d.notes || '-'}</p>
                            <div className="tdsm-action">
                                <button type="button" className="pq-btn-ghost-danger" onClick={() => setConfirmItem(d)} title="Remove deposit" aria-label="Remove deposit">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay tdsm-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal tdsm-modal">
                        <div className="tdsm-modal-header">
                            <h2>Add TDS Deposit</h2>
                            <p className="admin-subtitle" style={{ margin: '4px 0 0' }}>
                                TDS Payable: <span style={{ fontWeight: 700, color: summary?.payable > 0 ? '#c0392b' : 'var(--moss)' }}>{formatINR(summary?.payable)}</span>
                            </p>
                        </div>
                        <div className="tdsm-modal-body">
                            <form id="tdsm-form" onSubmit={submit}>
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
                                            value={form.tdsSectionId} onChange={v => setField('tdsSectionId', v)} placeholder="All sections (lump sum)" loading={refDataLoading}
                                            options={tdsSections.map(s => ({ value: s._id, label: `${s.name}${s.code ? ` (${s.code})` : ''}` }))}
                                        />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Bank Account</p>
                                        <StyledSelect
                                            value={form.bankAccountId} onChange={v => setField('bankAccountId', v)} placeholder="Cash" loading={refDataLoading}
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
                            </form>
                        </div>
                        <div className="edit-modal-actions tdsm-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button type="submit" form="tdsm-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this deposit?</h3>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default TdsPayableManager;
