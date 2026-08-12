import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import SettingSelectField, { registerSettingIfNew } from './SettingSelectField';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import ViewAttachmentLink from './ViewAttachmentLink';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '', tdsSectionId: '', tdsAmount: '', projectId: '', isRefund: false };

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
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [paymentModes, setPaymentModes] = useState([]);
    const [payments, setPayments] = useState([]);
    const [amountOwed, setAmountOwed] = useState(null);
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState(emptyForm);
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        Promise.all([
            axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
                .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
                .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {}),
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'payment_mode' } })
                .then(res => { if (res.data.success) setPaymentModes(res.data.data.map(s => s.name)); }).catch(() => {}),
        ]).finally(() => setRefDataLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchProjects = () => {
        setProjectsLoading(true);
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {}).finally(() => setProjectsLoading(false));
    };
    useEffect(fetchProjects, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/vendor-payments/list`, { ...authHeader, params: { vendorId } });
            if (res.data.success) setPayments(res.data.data);
        } catch { toast.error('Error fetching payments'); }
        finally { setLoading(false); }
    };

    // Amount Owed — same purchases − returns − payments formula
    // VendorLedgerView.jsx already shows, surfaced here too so it's visible
    // right where you're about to record a payment against it, not just on
    // the separate Ledger tab.
    const fetchAmountOwed = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/vendors/${vendorId}/ledger`, authHeader);
            if (res.data.success) setAmountOwed(res.data.data.totals.amountOwed);
        } catch { setAmountOwed(null); }
    };

    useEffect(() => {
        if (vendorId) { fetchPayments(); fetchAmountOwed(); } else { setPayments([]); setAmountOwed(null); }
    }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A payment for this vendor recorded elsewhere (VendorLedgerView, or
    // this same tab in another browser tab/admin) wouldn't otherwise show
    // up here until the vendor was reselected.
    useFinanceWsRefresh(['financeVendorLedgerChanged'], () => { if (vendorId) { fetchPayments(); fetchAmountOwed(); } });

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
            if (res.data.success) {
                if (form.paymentMode) await registerSettingIfNew(url, authHeader, 'payment_mode', form.paymentMode, paymentModes.map(m => ({ name: m })));
                toast.success(res.data.message); setForm(emptyForm); setFile(null); setModalOpen(false);
                await fetchPayments(); await fetchAmountOwed();
            }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording payment'); }
        finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/vendor-payments/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchPayments(); await fetchAmountOwed(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing payment'); }
        finally { setDeleting(false); }
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
                    <div className="pq-section-header" style={{ marginBottom: '8px' }}>
                        <h3 style={{ margin: 0 }}>Payments</h3>
                        <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>+ Add Payment</button>
                    </div>
                    {amountOwed !== null && (
                        <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                            Amount Owed: <span style={{ fontWeight: 700, color: amountOwed > 0 ? '#c0392b' : 'var(--moss)' }}>₹{amountOwed.toLocaleString('en-IN')}</span>
                        </p>
                    )}
                    {loading ? (
                        <div className="admin-empty-state"><p>Loading…</p></div>
                    ) : payments.length === 0 ? (
                        <div className="admin-empty-state"><p>No payments recorded yet.</p></div>
                    ) : (
                        <div className="dash-chart-card vpm-card">
                            <div className="vpm-row vpm-header">
                                <b className="vpm-date">Date</b>
                                <b className="vpm-amount">Amount</b>
                                <b className="vpm-mode">Mode</b>
                                <b className="vpm-account">Account</b>
                                <b className="vpm-tds">TDS</b>
                                <b className="vpm-attachment">Attachment</b>
                                <b className="vpm-action">Action</b>
                            </div>
                            {payments.map(p => (
                                <div key={p._id} className="vpm-row">
                                    <p className="vpm-date">{new Date(p.date).toLocaleDateString()}</p>
                                    <p className="vpm-amount"><span className="pq-group-label">Amount</span>₹{p.amount.toLocaleString('en-IN')}</p>
                                    <p className="vpm-mode"><span className="pq-group-label">Mode</span>{p.paymentMode || '-'}</p>
                                    <p className="vpm-account"><span className="pq-group-label">Account</span>{p.bankAccountId?.accountName || 'Cash'}</p>
                                    <p className="vpm-tds"><span className="pq-group-label">TDS</span>{p.tdsAmount ? `₹${p.tdsAmount.toLocaleString('en-IN')}${p.tdsSectionId?.name ? ` (${p.tdsSectionId.name})` : ''}` : '-'}</p>
                                    <p className="vpm-attachment"><span className="pq-group-label">Attachment</span>{p.attachmentUrl ? <ViewAttachmentLink url={p.attachmentUrl}>View</ViewAttachmentLink> : '-'}</p>
                                    <div className="vpm-action">
                                        <button type="button" className="pq-btn-ghost-danger" onClick={() => setConfirmItem(p)} title="Remove payment" aria-label="Remove payment">
                                            <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {modalOpen && ReactDOM.createPortal(
                        <div className="submit-loader-overlay vpm-overlay" style={{ zIndex: 99999 }}>
                            <div className="loader-modal-box edit-modal vpm-modal">
                                <div className="vpm-modal-header">
                                    <h2>{form.isRefund ? 'Add Refund' : 'Add Payment'}</h2>
                                    {amountOwed !== null && (
                                        <p className="admin-subtitle" style={{ margin: '4px 0 0' }}>
                                            Payment Left: <span style={{ fontWeight: 700, color: amountOwed > 0 ? '#c0392b' : 'var(--moss)' }}>₹{amountOwed.toLocaleString('en-IN')}</span>
                                        </p>
                                    )}
                                </div>
                                <div className="vpm-modal-body">
                                    <form id="vpm-form" onSubmit={submit}>
                                        <div className="wizard-field-grid">
                                            <div className="add-product-name flex-col wizard-field-full" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                                                <input type="checkbox" id="vpm-is-refund" checked={form.isRefund} onChange={e => setField('isRefund', e.target.checked)} />
                                                <label htmlFor="vpm-is-refund" style={{ margin: 0 }}>This is a refund from the vendor (money coming in, not out)</label>
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Amount (₹) *</p>
                                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Date *</p>
                                                <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Project (optional)</p>
                                                <StyledSelect
                                                    value={form.projectId} onChange={v => setField('projectId', v)} placeholder="Not tied to a project" loading={projectsLoading}
                                                    options={projects.map(p => ({ value: p._id, label: p.name }))}
                                                />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Payment Mode</p>
                                                <SettingSelectField settingType="payment_mode" options={paymentModes.map(m => ({ _id: m, name: m }))}
                                                    value={form.paymentMode} onChange={v => setField('paymentMode', v)} placeholder="e.g. Cash, Bank Transfer, UPI…" />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Bank Account (leave blank if cash)</p>
                                                <StyledSelect
                                                    value={form.bankAccountId} onChange={v => setField('bankAccountId', v)} placeholder="Choose Bank Account" loading={refDataLoading}
                                                    options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                                                />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>TDS Section</p>
                                                <StyledSelect
                                                    value={form.tdsSectionId} onChange={v => setField('tdsSectionId', v)} placeholder="No TDS" loading={refDataLoading}
                                                    options={tdsSections.map(s => ({ value: s._id, label: `${s.name}${s.code ? ` (${s.code})` : ''}` }))}
                                                />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>TDS Amount (optional)</p>
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
                                    </form>
                                </div>
                                <div className="edit-modal-actions vpm-modal-footer">
                                    <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                                    <button type="submit" form="vpm-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : (form.isRefund ? 'Save Refund' : 'Save Payment')}</button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </>
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this payment?</h3>
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

export default VendorPaymentsManager;
