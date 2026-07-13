import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const emptyForm = { runningBillId: '', amount: '', receiptDate: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '' };

/*
 * Receipts for one project — used both scoped (ProjectDetail's Receipts
 * tab, `projectId` prop set) and unscoped (the Receipts page, no
 * `projectId` — a project picker is shown first). clientId is derived
 * from the selected project, not asked for separately.
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

    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (fixedProjectId) return;
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url, fixedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const submit = async (e) => {
        e.preventDefault();
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
                setForm(emptyForm);
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
                    <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
                        <option value="">Select project…</option>
                        {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                </div>
            )}

            {!selectedProjectId ? (
                <div className="admin-empty-state"><p>Select a project to record or view receipts.</p></div>
            ) : (
                <>
                    <form onSubmit={submit} style={{ marginBottom: '28px' }}>
                        <div className="wizard-field-grid">
                            <div className="add-product-name flex-col">
                                <p>Amount (₹) *</p>
                                <input type="number" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Receipt Date *</p>
                                <input type="date" value={form.receiptDate} onChange={e => setField('receiptDate', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Against Bill (optional)</p>
                                <select value={form.runningBillId} onChange={e => setField('runningBillId', e.target.value)}>
                                    <option value="">— Not tied to a specific bill —</option>
                                    {issuedBills.map(b => <option key={b._id} value={b._id}>#{b.billNumber} — ₹{b.totalAmount.toLocaleString('en-IN')}</option>)}
                                </select>
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Payment Mode</p>
                                <input type="text" list="payment-mode-options" value={form.paymentMode} onChange={e => setField('paymentMode', e.target.value)} />
                                <datalist id="payment-mode-options">
                                    {paymentModes.map(m => <option key={m} value={m} />)}
                                </datalist>
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Bank Account (leave blank if cash)</p>
                                <select value={form.bankAccountId} onChange={e => setField('bankAccountId', e.target.value)}>
                                    <option value="">— Cash —</option>
                                    {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.accountName} — {a.bankName}</option>)}
                                </select>
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Bank / Cash Label (legacy free text, optional)</p>
                                <input type="text" value={form.bankOrCashLabel} onChange={e => setField('bankOrCashLabel', e.target.value)} placeholder="e.g. HDFC Current A/c, or Cash" />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>UTR / Reference Number</p>
                                <input type="text" value={form.utrNumber} onChange={e => setField('utrNumber', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col wizard-field-full">
                                <p>Notes</p>
                                <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                            </div>
                        </div>
                        <div className="wizard-actions" style={{ marginTop: '20px' }}>
                            <span />
                            <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Record Receipt'}</button>
                        </div>
                    </form>

                    <div className="list-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 100px' }}>
                            <b>Date</b><b>Amount</b><b>Bill</b><b>Mode</b><b>Account</b><b>Reference</b><b>Action</b>
                        </div>
                        {loading ? (
                            <div className="admin-empty-state"><p>Loading…</p></div>
                        ) : receipts.length === 0 ? (
                            <div className="admin-empty-state"><p>No receipts recorded yet.</p></div>
                        ) : (
                            receipts.map(r => (
                                <div key={r._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 100px' }}>
                                    <p>{new Date(r.receiptDate).toLocaleDateString()}</p>
                                    <p>₹{r.amount.toLocaleString('en-IN')}</p>
                                    <p>{r.runningBillId?.billNumber ? `#${r.runningBillId.billNumber}` : '—'}</p>
                                    <p>{r.paymentMode || '—'}</p>
                                    <p>{r.bankAccountId?.accountName || 'Cash'}</p>
                                    <p>{r.utrNumber || r.bankOrCashLabel || '—'}</p>
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
