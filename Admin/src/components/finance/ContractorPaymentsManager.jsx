import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import SettingSelectField, { registerSettingIfNew } from './SettingSelectField';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', workId: '', projectId: '', tdsSectionId: '', tdsAmount: '' };

// See ContractorLedgerView.jsx's identical helper.
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const calcTds = (rate, amount) => (rate != null && amount ? round2((rate / 100) * Number(amount)) : '');

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

    const [vendorId, setVendorId] = useState('');
    const [bankAccounts, setBankAccounts] = useState([]);
    const [tdsSections, setTdsSections] = useState([]);
    const [workTypeSettings, setWorkTypeSettings] = useState([]);
    const [works, setWorks] = useState([]);
    const [paymentModes, setPaymentModes] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState(emptyForm);
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
            .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'payment_mode' } })
            .then(res => { if (res.data.success) setPaymentModes(res.data.data.map(s => s.name)); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'work_type' } })
            .then(res => { if (res.data.success) setWorkTypeSettings(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // This picker has no ledger loaded (unlike ContractorLedgerView), so the
    // Work picker's options come from this contractor's own assignments
    // directly — same endpoint, now filterable by contractorVendorId.
    useEffect(() => {
        if (!vendorId) { setWorks([]); return; }
        axios.get(`${url}/api/finance/work-contractor-assignments/list`, { ...authHeader, params: { contractorVendorId: vendorId } })
            .then(res => { if (res.data.success) setWorks(res.data.data.filter(a => a.workId)); }).catch(() => {});
    }, [url, vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/contractor-payments/list`, { ...authHeader, params: { vendorId } });
            if (res.data.success) setPayments(res.data.data);
        } catch { toast.error('Error fetching payments'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (vendorId) fetchPayments(); else setPayments([]); }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment for this contractor recorded elsewhere (ContractorLedgerView,
    // or this same tab in another browser tab/admin) wouldn't otherwise show
    // up here until the contractor was reselected.
    useFinanceWsRefresh(['financeContractorLedgerChanged'], () => { if (vendorId) fetchPayments(); });

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    // See ContractorLedgerView.jsx's identical handlers.
    const onSelectWork = (workId) => {
        const assignment = works.find(a => a.workId?._id === workId);
        const workType = workTypeSettings.find(t => t.name === assignment?.workId?.workType);
        const section = workType?.tdsSectionId || null;
        // Tag the payment with the Work's own project too — see
        // ContractorLedgerView.jsx's identical comment.
        setForm(p => ({
            ...p, workId, projectId: assignment?.workId?.projectId?._id || '',
            tdsSectionId: section?._id || '', tdsAmount: calcTds(section?.rate, p.amount),
        }));
    };
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
            if (res.data.success) {
                if (form.paymentMode) await registerSettingIfNew(url, authHeader, 'payment_mode', form.paymentMode, paymentModes.map(m => ({ name: m })));
                toast.success(res.data.message); setForm(emptyForm); setFile(null); setModalOpen(false); await fetchPayments();
            }
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
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
                <p>Contractor</p>
                <QuickAddPicker url={url} resourceKey="vendors" value={vendorId} onChange={setVendorId}
                    filter={v => v.vendorType === 'labour_contractor'} presetValues={{ vendorType: 'labour_contractor' }} placeholder="Select contractor…" />
            </div>

            {!vendorId ? (
                <div className="admin-empty-state"><p>Select a contractor to record or view payments.</p></div>
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
                            <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 100px' }}>
                                <b>Date</b><b>Amount</b><b>Mode</b><b>Account</b><b>TDS</b><b>Attachment</b><b>Action</b>
                            </div>
                            {payments.map(p => (
                                <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 100px' }}>
                                    <p>{new Date(p.date).toLocaleDateString()}</p>
                                    <p>₹{p.amount.toLocaleString('en-IN')}</p>
                                    <p>{p.paymentMode || '-'}</p>
                                    <p>{p.bankAccountId?.accountName || 'Cash'}</p>
                                    <p>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                                    <p>{p.attachmentUrl ? <a href={p.attachmentUrl} target="_blank" rel="noreferrer">View</a> : '-'}</p>
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
                                            <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.amount} onChange={e => onChangeAmount(e.target.value)} />
                                        </div>
                                        <div className="add-product-name flex-col">
                                            <p>Date *</p>
                                            <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                                        </div>
                                        <div className="add-product-name flex-col">
                                            <p>Work (optional — resolves TDS from its type)</p>
                                            <StyledSelect
                                                value={form.workId} onChange={onSelectWork} placeholder="Not tied to a Work"
                                                options={works.map(a => ({ value: a.workId._id, label: `${a.workId.workType} — ${a.workId.projectId?.name || '—'}` }))}
                                            />
                                        </div>
                                        <div className="add-product-name flex-col">
                                            <p>Payment Mode</p>
                                            <SettingSelectField settingType="payment_mode" options={paymentModes.map(m => ({ _id: m, name: m }))}
                                                value={form.paymentMode} onChange={v => setField('paymentMode', v)} placeholder="e.g. Cash, Bank Transfer, UPI…" />
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
                                        <div className="add-product-name flex-col">
                                            <p>UTR / Reference Number</p>
                                            <input type="text" value={form.utrNumber} onChange={e => setField('utrNumber', e.target.value)} />
                                        </div>
                                        <div className="add-product-name flex-col">
                                            <p>Attachment</p>
                                            <input type="file" onChange={e => setFile(e.target.files[0] || null)} />
                                        </div>
                                        <div className="add-product-name flex-col wizard-field-full">
                                            <p>Notes</p>
                                            <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                                        </div>
                                        <div className="add-product-name flex-col wizard-field-full">
                                            <p>Bank / Cash Label (legacy, optional)</p>
                                            <input type="text" value={form.bankOrCashLabel} onChange={e => setField('bankOrCashLabel', e.target.value)} />
                                        </div>
                                    </div>
                                    {form.amount > 0 && (
                                        <p className="admin-subtitle" style={{ margin: '-8px 0 12px' }}>
                                            Gross: ₹{Number(form.amount).toLocaleString('en-IN')}
                                            {form.tdsAmount > 0 && ` · TDS: ₹${Number(form.tdsAmount).toLocaleString('en-IN')} · Net Payable: ₹${(Number(form.amount) - Number(form.tdsAmount)).toLocaleString('en-IN')}`}
                                        </p>
                                    )}
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

export default ContractorPaymentsManager;
