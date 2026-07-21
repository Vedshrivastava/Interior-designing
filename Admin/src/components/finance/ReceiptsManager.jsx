import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import SettingSelectField, { registerSettingIfNew } from './SettingSelectField';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { runningBillId: '', amount: '', receiptDate: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '' };

/*
 * Receipts for one project — used both scoped (ProjectDetail's Receipts
 * tab, `projectId` prop set) and unscoped (the Receipts page, no
 * `projectId` — a project picker is shown first). clientId is derived
 * from the selected project, not asked for separately.
 *
 * The Account column's "Cash" fallback used to fire whenever bankAccountId
 * was empty — including receipts nothing ever asked about (the old
 * advance-received flow didn't collect a payment mode or bank account at
 * all), which made unrecorded payments falsely read as "Cash". It now only
 * says Cash when a payment mode was actually captured; otherwise it's
 * honestly "-".
 */
const ReceiptsManager = ({ url, projectId: fixedProjectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(fixedProjectId || '');
    const [projectDetail, setProjectDetail] = useState(null);
    const [issuedBills, setIssuedBills] = useState([]);
    const [paymentModes, setPaymentModes] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const fetchProjects = () => {
        if (fixedProjectId) return;
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    };
    useEffect(fetchProjects, [url, fixedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    useEffect(() => {
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'payment_mode' } })
            .then(res => { if (res.data.success) setPaymentModes(res.data.data.map(s => s.name)); }).catch(() => {});
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchReceipts = async (pid) => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/receipts/list`, { ...authHeader, params: { projectId: pid } });
            if (res.data.success) setReceipts(res.data.data);
        } catch { toast.error('Error fetching receipts'); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (!selectedProjectId) { setProjectDetail(null); setIssuedBills([]); setReceipts([]); return; }
        axios.get(`${url}/api/finance/projects/${selectedProjectId}`, authHeader)
            .then(res => { if (res.data.success) setProjectDetail(res.data.data.project); }).catch(() => {});
        axios.get(`${url}/api/finance/running-bills/list`, { ...authHeader, params: { projectId: selectedProjectId, status: 'issued' } })
            .then(res => { if (res.data.success) setIssuedBills(res.data.data); }).catch(() => {});
        fetchReceipts(selectedProjectId);
    }, [url, selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const openAdd = () => { setForm(emptyForm); setModalOpen(true); };
    const closeModal = () => setModalOpen(false);

    const submit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedProjectId || !projectDetail?.clientId) return toast.error('Select a project');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.receiptDate) return toast.error('Receipt date is required');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/receipts/add`, {
                ...form,
                projectId: selectedProjectId,
                clientId: projectDetail.clientId._id || projectDetail.clientId,
                runningBillId: form.runningBillId || null,
            }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                await registerSettingIfNew(url, authHeader, 'payment_mode', form.paymentMode, paymentModes.map(m => ({ name: m })));
                closeModal();
                await fetchReceipts(selectedProjectId);
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error recording receipt');
        } finally { setSaving(false); }
    };

    const removeReceipt = async (r) => {
        try {
            const res = await axios.delete(`${url}/api/finance/receipts/remove`, { ...authHeader, data: { _id: r._id } });
            if (res.data.success) { toast.success(res.data.message); await fetchReceipts(selectedProjectId); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing receipt'); }
    };

    return (
        <div>
            {!fixedProjectId && (
                <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                    <p>Project</p>
                    <StyledSelect
                        value={selectedProjectId} onChange={setSelectedProjectId} placeholder="Select project…"
                        options={projects.map(p => ({ value: p._id, label: p.name }))}
                    />
                </div>
            )}

            {!selectedProjectId ? (
                <div className="admin-empty-state"><p>Select a project to record or view receipts.</p></div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div>
                            <h3 style={{ margin: '0 0 4px' }}>Receipts</h3>
                            <p className="admin-subtitle" style={{ margin: 0 }}>Money actually received from the client, optionally tied to one issued bill.</p>
                        </div>
                        <button type="button" className="add-btn" onClick={openAdd}>+ Record Receipt</button>
                    </div>

                    {modalOpen && ReactDOM.createPortal(
                        <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
                            <div className="loader-modal-box edit-modal">
                                <h2>Record Receipt</h2>
                                <form onSubmit={submit}>
                                    <div className="wizard-field-grid">
                                        <div className="add-product-name flex-col">
                                            <p>Amount (₹) *</p>
                                            <input type="number" onWheel={e => e.target.blur()} min="0" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                                        </div>
                                        <div className="add-product-name flex-col">
                                            <p>Receipt Date *</p>
                                            <StyledDatePicker value={form.receiptDate} onChange={v => setField('receiptDate', v)} />
                                        </div>
                                        <div className="add-product-name flex-col wizard-field-full">
                                            <p>Against Bill (optional)</p>
                                            <StyledSelect
                                                value={form.runningBillId} onChange={v => setField('runningBillId', v)}
                                                placeholder="Not tied to a specific bill"
                                                options={issuedBills.map(b => ({ value: b._id, label: `#${b.billNumber} · ₹${b.totalAmount.toLocaleString('en-IN')}` }))}
                                            />
                                        </div>
                                        <div className="add-product-name flex-col">
                                            <p>Payment Mode</p>
                                            <SettingSelectField
                                                settingType="payment_mode" options={paymentModes.map(m => ({ _id: m, name: m }))}
                                                value={form.paymentMode} onChange={v => setField('paymentMode', v)} placeholder="e.g. Cash, Bank Transfer, UPI…"
                                            />
                                        </div>
                                        <div className="add-product-name flex-col">
                                            <p>Bank Account (leave blank if cash)</p>
                                            <StyledSelect
                                                value={form.bankAccountId} onChange={v => setField('bankAccountId', v)} placeholder="Cash"
                                                options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                                            />
                                        </div>
                                        <div className="add-product-name flex-col">
                                            <p>UTR / Reference Number</p>
                                            <input type="text" value={form.utrNumber} onChange={e => setField('utrNumber', e.target.value)} />
                                        </div>
                                        <div className="add-product-name flex-col">
                                            <p>Bank / Cash Label (legacy, optional)</p>
                                            <input type="text" value={form.bankOrCashLabel} onChange={e => setField('bankOrCashLabel', e.target.value)} placeholder="e.g. HDFC Current A/c, or Cash" />
                                        </div>
                                        <div className="add-product-name flex-col wizard-field-full">
                                            <p>Notes</p>
                                            <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="edit-modal-actions">
                                        <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                                        <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Record Receipt'}</button>
                                    </div>
                                </form>
                            </div>
                        </div>,
                        document.body
                    )}

                    <div className="list-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1.2fr 1fr 90px' }}>
                            <b>Date</b><b>Amount</b><b>Bill</b><b>Mode</b><b>Account</b><b>Reference</b><b>Action</b>
                        </div>
                        {loading ? (
                            <div className="admin-empty-state"><p>Loading…</p></div>
                        ) : receipts.length === 0 ? (
                            <div className="admin-empty-state"><p>No receipts recorded yet.</p></div>
                        ) : (
                            receipts.map(r => (
                                <div key={r._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1.2fr 1fr 90px' }}>
                                    <p>{new Date(r.receiptDate).toLocaleDateString()}</p>
                                    <p>₹{r.amount.toLocaleString('en-IN')}</p>
                                    <p>{r.runningBillId?.billNumber ? `#${r.runningBillId.billNumber}` : '-'}</p>
                                    <p>{r.paymentMode || '-'}</p>
                                    <p>{r.bankAccountId?.accountName || (r.paymentMode ? 'Cash' : '-')}</p>
                                    <p>{r.utrNumber || r.bankOrCashLabel || '-'}</p>
                                    <div className="action-buttons">
                                        <p onClick={() => removeReceipt(r)} className="cursor delete-action">X</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default ReceiptsManager;
