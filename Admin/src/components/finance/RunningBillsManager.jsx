import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const STATUS_LABEL = { draft: 'Draft', issued: 'Issued' };

/*
 * Running Bills for one project — list + a "Generate Bill" flow that
 * previews line items (GET /running-bills/preview) before the user
 * confirms (POST /running-bills/generate). Both endpoints share the exact
 * same server-side computation, so the preview can't lie about what
 * generation will actually produce.
 *
 * `statusFilter` (optional): 'draft' | 'issued' — used by the Receivables
 * page's Pending Bills / Approved Bills tabs to show the same list, filtered.
 */
const RunningBillsManager = ({ url, projectId, statusFilter }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [periodFrom, setPeriodFrom] = useState('');
    const [periodTo, setPeriodTo] = useState('');
    const [billDate, setBillDate] = useState('');
    const [gstRate, setGstRate] = useState('');
    const [preview, setPreview] = useState(null);
    const [previewing, setPreviewing] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [gstEditItem, setGstEditItem] = useState(null);
    const [gstEditValue, setGstEditValue] = useState('');
    const [savingGst, setSavingGst] = useState(false);

    const fetchBills = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/running-bills/list`, { ...authHeader, params: { projectId, status: statusFilter || undefined } });
            if (res.data.success) setBills(res.data.data);
        } catch { toast.error('Error fetching running bills'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (projectId) fetchBills(); }, [projectId, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const openGenerate = () => {
        setPeriodFrom(''); setPeriodTo(''); setBillDate(new Date().toISOString().slice(0, 10)); setGstRate(''); setPreview(null);
        setModalOpen(true);
        // Prefill (not lock) gstRate from Settings > GST.
        axios.get(`${url}/api/finance/settings/company`, authHeader).then(res => {
            const rate = res.data.success ? res.data.data.defaultGstRate : null;
            if (rate !== null && rate !== undefined) setGstRate(rate);
        }).catch(() => {});
        // Prefill "From" with the day after the last bill's period end
        // (any status, ignoring statusFilter — this needs the true latest
        // bill), so periods can't accidentally overlap and double-count a
        // boundary-day measurement. Falls back to the project's start date
        // for a project's very first bill.
        axios.get(`${url}/api/finance/running-bills/list`, { ...authHeader, params: { projectId } }).then(res => {
            if (!res.data.success) return;
            const latest = [...res.data.data].sort((a, b) => new Date(b.periodTo) - new Date(a.periodTo))[0];
            if (latest) {
                const next = new Date(latest.periodTo);
                next.setDate(next.getDate() + 1);
                setPeriodFrom(next.toISOString().slice(0, 10));
            } else {
                axios.get(`${url}/api/finance/projects/list`, authHeader).then(pRes => {
                    if (!pRes.data.success) return;
                    const project = pRes.data.data.find(p => p._id === projectId);
                    if (project?.startDate) setPeriodFrom(new Date(project.startDate).toISOString().slice(0, 10));
                }).catch(() => {});
            }
        }).catch(() => {});
    };
    const closeModal = () => setModalOpen(false);

    const runPreview = async () => {
        if (!periodFrom || !periodTo) return toast.error('Select a date range');
        setPreviewing(true);
        setPreview(null);
        try {
            const res = await axios.get(`${url}/api/finance/running-bills/preview`, { ...authHeader, params: { projectId, periodFrom, periodTo } });
            if (res.data.success) setPreview(res.data.data);
            else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error building preview');
        } finally { setPreviewing(false); }
    };

    const confirmGenerate = async () => {
        setGenerating(true);
        try {
            const res = await axios.post(`${url}/api/finance/running-bills/generate`, { projectId, periodFrom, periodTo, billDate, gstRate }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                closeModal();
                await fetchBills();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error generating bill');
        } finally { setGenerating(false); }
    };

    const toggleStatus = async (bill) => {
        const nextStatus = bill.status === 'draft' ? 'issued' : 'draft';
        try {
            const res = await axios.post(`${url}/api/finance/running-bills/update`, { _id: bill._id, status: nextStatus }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchBills(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error updating bill status'); }
    };

    const openGstEdit = (bill) => { setGstEditValue(bill.gstRate ?? ''); setGstEditItem(bill); };

    const saveGst = async () => {
        setSavingGst(true);
        try {
            const res = await axios.post(`${url}/api/finance/running-bills/update-gst`, { _id: gstEditItem._id, gstRate: gstEditValue }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setGstEditItem(null); await fetchBills(); }
            else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error updating GST');
        } finally { setSavingGst(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/running-bills/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchBills(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing bill'); }
        finally { setDeleting(false); }
    };

    // Protected download — the PDF endpoint needs the Bearer token, so a
    // plain <a href> won't carry auth; fetch as a blob and trigger the
    // save via a throwaway anchor instead.
    const downloadStatement = async (bill) => {
        try {
            const res = await axios.get(`${url}/api/finance/running-bills/${bill._id}/statement/download`, { ...authHeader, responseType: 'blob' });
            const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const a = document.createElement('a');
            a.href = blobUrl; a.download = `Bill-Statement-${bill.billNumber}.pdf`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch { toast.error('Error downloading statement'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button type="button" className="add-point-btn" onClick={openGenerate}>+ Generate Bill</button>
            </div>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '0.7fr 1fr 1.3fr 1fr 1fr 220px' }}>
                    <b>Bill #</b><b>Date</b><b>Period</b><b>Total</b><b>Status</b><b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : bills.length === 0 ? (
                    <div className="admin-empty-state"><p>No bills yet.</p></div>
                ) : (
                    bills.map(b => (
                        <div key={b._id} className="list-table-format row-item" style={{ gridTemplateColumns: '0.7fr 1fr 1.3fr 1fr 1fr 220px' }}>
                            <p>#{b.billNumber}</p>
                            <p>{new Date(b.billDate).toLocaleDateString()}</p>
                            <p>{new Date(b.periodFrom).toLocaleDateString()} – {new Date(b.periodTo).toLocaleDateString()}</p>
                            <p>
                                ₹{b.totalAmount.toLocaleString('en-IN')}
                                {b.gstAmount
                                    ? ` + GST (${b.gstRate}%)`
                                    : (b.status === 'issued' && (
                                        <span title="Mark this bill Draft to add GST — it's locked once issued." style={{ color: 'var(--text-lt)', fontSize: '0.85em' }}> · no GST</span>
                                    ))}
                            </p>
                            <p onClick={() => toggleStatus(b)} className="cursor" style={{ color: b.status === 'issued' ? 'var(--moss)' : 'var(--text-lt)' }}>
                                <span className="item-category">{STATUS_LABEL[b.status]}</span>
                            </p>
                            <div className="action-buttons">
                                {b.status === 'draft' && <p onClick={() => openGstEdit(b)} className="cursor edit-action">GST</p>}
                                <p onClick={() => downloadStatement(b)} className="cursor edit-action">Statement</p>
                                <p onClick={() => setConfirmItem(b)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal" style={{ maxWidth: '620px' }}>
                        <h2>Generate Running Bill</h2>
                        <div className="wizard-field-grid">
                            <div className="add-product-name flex-col">
                                <p>Period From *</p>
                                <input type="date" value={periodFrom} onChange={e => { setPeriodFrom(e.target.value); setPreview(null); }} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Period To *</p>
                                <input type="date" value={periodTo} onChange={e => { setPeriodTo(e.target.value); setPreview(null); }} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Bill Date</p>
                                <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>GST Rate % (optional)</p>
                                <input type="number" value={gstRate} onChange={e => setGstRate(e.target.value)} />
                            </div>
                        </div>

                        <div style={{ margin: '16px 0' }}>
                            <button type="button" className="add-point-btn" disabled={previewing} onClick={runPreview}>
                                {previewing ? 'Building preview…' : 'Preview Line Items'}
                            </button>
                        </div>

                        {preview && (
                            <div className="list-table" style={{ marginBottom: '16px' }}>
                                <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr' }}>
                                    <b>Work Type</b><b>Area</b><b>Rate</b><b>Amount</b>
                                </div>
                                {preview.lineItems.map((li, i) => (
                                    <div key={i} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr' }}>
                                        <p>{li.workType}</p>
                                        <p>{li.areaBilledSqft} sqft</p>
                                        <p>₹{li.clientRatePerSqft}/sqft</p>
                                        <p>₹{li.amount.toLocaleString('en-IN')}</p>
                                    </div>
                                ))}
                                <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr', fontWeight: 600 }}>
                                    <p>
                                        Total: ₹{preview.totalAmount.toLocaleString('en-IN')}
                                        {gstRate && ` + GST (${gstRate}%): ₹${(preview.totalAmount * (Number(gstRate) / 100)).toLocaleString('en-IN')}`}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="edit-modal-actions">
                            <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                            <button type="button" className="add-btn" disabled={!preview || generating} onClick={confirmGenerate}>
                                {generating ? 'Generating…' : 'Confirm & Generate'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {gstEditItem && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal" style={{ maxWidth: '380px' }}>
                        <h2>GST — Bill #{gstEditItem.billNumber}</h2>
                        <p style={{ margin: '4px 0 16px', color: 'var(--text-lt)', fontSize: '0.9em' }}>
                            Applies to the subtotal of ₹{gstEditItem.totalAmount.toLocaleString('en-IN')}. Leave blank for no GST.
                        </p>
                        <div className="add-product-name flex-col">
                            <p>GST Rate %</p>
                            <input type="number" value={gstEditValue} onChange={e => setGstEditValue(e.target.value)} autoFocus />
                        </div>
                        {gstEditValue !== '' && (
                            <p style={{ margin: '12px 0 0', fontWeight: 600 }}>
                                Grand Total: ₹{(gstEditItem.totalAmount * (1 + Number(gstEditValue) / 100)).toLocaleString('en-IN')}
                            </p>
                        )}
                        <div className="edit-modal-actions">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setGstEditItem(null)}>Cancel</button>
                            <button type="button" className="add-btn" disabled={savingGst} onClick={saveGst}>
                                {savingGst ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove Bill #{confirmItem.billNumber}?</h3>
                        <p className="bin-confirm-warning">Its measurements become billable again — moved to Recovery Bin.</p>
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

export default RunningBillsManager;
