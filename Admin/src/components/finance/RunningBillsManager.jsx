import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import { useFileDownload } from '../../hooks/useFileDownload';
import DownloadButton from './DownloadButton';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const STATUS_LABEL = { draft: 'Draft', issued: 'Issued' };

/*
 * Running Bills for one project — list + a "Generate Bill" flow. GET
 * /running-bills/available returns, per work type, how much logged sqft
 * hasn't been approved yet (Total minus what's already in an issued bill);
 * the engineer edits those figures down to what they're actually
 * confirming (never up — that's the real ceiling) before generating. The
 * ₹ amount is always computed server-side from the configured Work Type
 * Rate, never trusted from the client.
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
    // Period From is a choice between two resolved anchors, not a free
    // date — see openGenerate's comment below for why.
    const [workStartDate, setWorkStartDate] = useState('');
    const [lastBillFromDate, setLastBillFromDate] = useState('');
    const [periodFromChoice, setPeriodFromChoice] = useState('lastBill');
    const periodFrom = (periodFromChoice === 'lastBill' && lastBillFromDate) ? lastBillFromDate : workStartDate;
    const [periodTo, setPeriodTo] = useState('');
    const [billDate, setBillDate] = useState('');
    const [gstRate, setGstRate] = useState('');
    const [available, setAvailable] = useState(null);
    const [loadingAvailable, setLoadingAvailable] = useState(false);
    const [workTypeSqft, setWorkTypeSqft] = useState({});
    const [generating, setGenerating] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [gstEditItem, setGstEditItem] = useState(null);
    const [gstEditValue, setGstEditValue] = useState('');
    const [savingGst, setSavingGst] = useState(false);
    const [downloadingKey, setDownloadingKey] = useState(null); // `${billId}:${mode}`
    const { progress: downloadProgress, run: runDownload } = useFileDownload(authHeader);

    const [pendingReviewByType, setPendingReviewByType] = useState([]);

    const fetchBills = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/running-bills/list`, { ...authHeader, params: { projectId, status: statusFilter || undefined } });
            if (res.data.success) setBills(res.data.data);
        } catch { toast.error('Error fetching running bills'); }
        finally { setLoading(false); }
    };

    // Surfaced as a banner below — work logged but never reviewed doesn't
    // show up in Generate Bill's own ceiling at all (it offers 0 for a
    // work type with nothing reviewed yet), so without this the engineer
    // would have no way to notice it's sitting there. Same data source as
    // WorkReviewPanel itself.
    const fetchPendingReview = async () => {
        if (!projectId) { setPendingReviewByType([]); return; }
        try {
            const res = await axios.get(`${url}/api/finance/work-reviews/project/${projectId}`, authHeader);
            if (!res.data.success) return;
            const byType = new Map();
            for (const row of res.data.data.rows) {
                if (row.pendingReviewSqft <= 0) continue;
                byType.set(row.workType, (byType.get(row.workType) || 0) + row.pendingReviewSqft);
            }
            setPendingReviewByType([...byType.entries()].map(([workType, sqft]) => ({ workType, sqft: Math.round((sqft + Number.EPSILON) * 100) / 100 })));
        } catch { /* non-critical — banner just stays empty */ }
    };

    useEffect(() => { if (projectId) { fetchBills(); fetchPendingReview(); } }, [projectId, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const openGenerate = () => {
        setWorkStartDate(''); setLastBillFromDate(''); setPeriodFromChoice('lastBill');
        setPeriodTo(''); setBillDate(new Date().toISOString().slice(0, 10)); setGstRate('');
        setAvailable(null); setWorkTypeSqft({});
        setModalOpen(true);
        // Prefill (not lock) gstRate from Settings > GST.
        axios.get(`${url}/api/finance/settings/company`, authHeader).then(res => {
            const rate = res.data.success ? res.data.data.defaultGstRate : null;
            if (rate !== null && rate !== undefined) setGstRate(rate);
        }).catch(() => {});
        // Period From is purely descriptive on the statement (nothing
        // queries by it), so rather than a free date picker the engineer
        // just picks between the two anchors that ever actually make
        // sense: the project's own start date, or the day after the last
        // bill's period end (any status, ignoring statusFilter — this
        // needs the true latest bill). Defaults to "from last bill" when
        // one exists, else falls back to "from work start".
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(pRes => {
            if (!pRes.data.success) return;
            const project = pRes.data.data.find(p => p._id === projectId);
            if (project?.startDate) setWorkStartDate(new Date(project.startDate).toISOString().slice(0, 10));
        }).catch(() => {});
        axios.get(`${url}/api/finance/running-bills/list`, { ...authHeader, params: { projectId } }).then(res => {
            if (!res.data.success) return;
            const latest = [...res.data.data].sort((a, b) => new Date(b.periodTo) - new Date(a.periodTo))[0];
            if (latest) {
                const next = new Date(latest.periodTo);
                next.setDate(next.getDate() + 1);
                setLastBillFromDate(next.toISOString().slice(0, 10));
                setPeriodFromChoice('lastBill');
            } else {
                setPeriodFromChoice('workStart');
            }
        }).catch(() => {});
        // What's available to approve, per work type — the engineer edits
        // these sqft values down from the logged ceiling before generating;
        // never auto-summed/locked in from measurement checkboxes.
        setLoadingAvailable(true);
        axios.get(`${url}/api/finance/running-bills/available`, { ...authHeader, params: { projectId } }).then(res => {
            if (res.data.success) {
                setAvailable(res.data.data);
                setWorkTypeSqft(Object.fromEntries(res.data.data.map(a => [a.workType, String(a.availableSqft)])));
            } else toast.error(res.data.message);
        }).catch(err => toast.error(err.response?.data?.message || 'Error fetching available work'))
          .finally(() => setLoadingAvailable(false));
    };
    const closeModal = () => setModalOpen(false);

    const setSqftFor = (workType, value) => setWorkTypeSqft(prev => ({ ...prev, [workType]: value }));

    const totalPreviewAmount = (available || []).reduce((sum, a) => {
        const sqft = Number(workTypeSqft[a.workType]) || 0;
        return sum + sqft * (a.clientRatePerSqft || 0);
    }, 0);

    const confirmGenerate = async () => {
        const payloadSqft = Object.fromEntries(
            Object.entries(workTypeSqft).filter(([, v]) => Number(v) > 0).map(([wt, v]) => [wt, Number(v)])
        );
        if (!Object.keys(payloadSqft).length) return toast.error('Enter approved sqft for at least one work type');
        setGenerating(true);
        try {
            const res = await axios.post(`${url}/api/finance/running-bills/generate`, { projectId, periodFrom, periodTo, billDate, gstRate, workTypeSqft: payloadSqft }, authHeader);
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

    // Protected download — a plain <a href> can't carry the Bearer token,
    // so this fetches the PDF as a blob (see useFileDownload) with a real,
    // live byte/percent readout while the transfer is in progress.
    // mode: 'color' (default) or 'bw' — same route, just ?mode=bw for a
    // grayscale statement meant for printing.
    const downloadStatement = async (bill, mode = 'color') => {
        setDownloadingKey(`${bill._id}:${mode}`);
        const suffix = mode === 'bw' ? '-BW' : '';
        await runDownload(
            url, `/api/finance/running-bills/${bill._id}/statement/download`,
            `Bill-Statement-${bill.billNumber}${suffix}.pdf`,
            mode === 'bw' ? { mode: 'bw' } : {},
            'Error downloading statement'
        );
        setDownloadingKey(null);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <h3 style={{ margin: '0 0 4px' }}>Running Bills</h3>
                    <p className="admin-subtitle" style={{ margin: 0 }}>Sqft is manually confirmed per work type at generation: draft until issued; only issued bills count as revenue or approved work.</p>
                </div>
                <button type="button" className="add-point-btn" style={{ whiteSpace: 'nowrap' }} onClick={openGenerate}>+ Generate Bill</button>
            </div>

            {pendingReviewByType.length > 0 && (
                <div className="admin-subtitle" style={{ background: '#fdf6e3', border: '1px solid #e8d9a8', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#8a6d1f' }}>
                    {pendingReviewByType.map(p => `${p.sqft} sqft of ${p.workType}`).join(', ')} logged but not yet reviewed — review it in Payables/Receivables → Deductions before it can be billed.
                </div>
            )}

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '0.7fr 1fr 1.3fr 1fr 110px 260px' }}>
                    <b>Bill #</b><b>Date</b><b>Period</b><b>Total</b><b>Status</b><b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : bills.length === 0 ? (
                    <div className="admin-empty-state"><p>No bills yet.</p></div>
                ) : (
                    bills.map(b => (
                        <div key={b._id} className="list-table-format row-item" style={{ gridTemplateColumns: '0.7fr 1fr 1.3fr 1fr 110px 260px' }}>
                            <p>#{b.billNumber}</p>
                            <p>{new Date(b.billDate).toLocaleDateString()}</p>
                            <p>{new Date(b.periodFrom).toLocaleDateString()} – {new Date(b.periodTo).toLocaleDateString()}</p>
                            <p>
                                ₹{b.totalAmount.toLocaleString('en-IN')}
                                {b.gstAmount
                                    ? ` + GST (${b.gstRate}%)`
                                    : (b.status === 'issued' && (
                                        <span title="Mark this bill Draft to add GST; it's locked once issued." style={{ color: 'var(--text-lt)', fontSize: '0.85em' }}> · no GST</span>
                                    ))}
                            </p>
                            <p onClick={() => toggleStatus(b)} className="cursor" style={{ color: b.status === 'issued' ? 'var(--moss)' : 'var(--text-lt)' }}>
                                <span className="item-category">{STATUS_LABEL[b.status]}</span>
                            </p>
                            <div className="action-buttons" style={{ flexWrap: 'wrap', rowGap: '6px' }}>
                                {b.status === 'draft' && <p onClick={() => openGstEdit(b)} className="cursor edit-action">GST</p>}
                                <DownloadButton
                                    as="p" downloading={downloadingKey === `${b._id}:color`} progress={downloadingKey === `${b._id}:color` ? downloadProgress : null}
                                    idleLabel="Statement" onClick={() => downloadStatement(b, 'color')} className="cursor edit-action"
                                />
                                <DownloadButton
                                    as="p" downloading={downloadingKey === `${b._id}:bw`} progress={downloadingKey === `${b._id}:bw` ? downloadProgress : null}
                                    idleLabel="B&W" onClick={() => downloadStatement(b, 'bw')} className="cursor edit-action"
                                />
                                <p onClick={() => setConfirmItem(b)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal" style={{ maxWidth: '660px' }}>
                        <h2>Generate Running Bill</h2>
                        <p className="admin-subtitle" style={{ margin: '4px 0 16px' }}>
                            Sqft below is pre-filled with everything logged and not yet approved; edit it down to what you're actually confirming for each work type. The ₹ amount is always derived from the configured rate.
                        </p>
                        <div className="wizard-field-grid">
                            <div className="add-product-name flex-col">
                                <p>Period From</p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        className={`labour-chip${periodFromChoice === 'lastBill' ? ' active' : ''}`}
                                        onClick={() => setPeriodFromChoice('lastBill')}
                                        disabled={!lastBillFromDate}
                                        style={!lastBillFromDate ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                                        title={!lastBillFromDate ? 'No prior bill for this project yet' : undefined}
                                    >
                                        From Last Bill{lastBillFromDate ? ` — ${new Date(lastBillFromDate).toLocaleDateString()}` : ''}
                                    </button>
                                    <button
                                        type="button"
                                        className={`labour-chip${periodFromChoice === 'workStart' ? ' active' : ''}`}
                                        onClick={() => setPeriodFromChoice('workStart')}
                                        disabled={!workStartDate}
                                        style={!workStartDate ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                                        title={!workStartDate ? 'Project has no start date set' : undefined}
                                    >
                                        From Work Start{workStartDate ? ` — ${new Date(workStartDate).toLocaleDateString()}` : ''}
                                    </button>
                                </div>
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Period To</p>
                                <StyledDatePicker value={periodTo} onChange={setPeriodTo} align="right" />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Bill Date</p>
                                <StyledDatePicker value={billDate} onChange={setBillDate} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>GST Rate % (optional)</p>
                                <input type="number" onWheel={e => e.target.blur()} min="0" value={gstRate} onChange={e => setGstRate(e.target.value)} />
                            </div>
                        </div>

                        {loadingAvailable ? (
                            <div className="admin-empty-state" style={{ margin: '16px 0' }}><p>Loading available work…</p></div>
                        ) : !available || available.length === 0 ? (
                            <div className="admin-empty-state" style={{ margin: '16px 0' }}><p>Nothing logged and unapproved for this project right now.</p></div>
                        ) : (
                            <div className="list-table" style={{ margin: '16px 0' }}>
                                <div className="list-table-format title" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1fr' }}>
                                    <b>Work Type</b><b>Approved Sqft</b><b>Rate</b><b>Amount</b>
                                </div>
                                {available.map(a => {
                                    const sqft = Number(workTypeSqft[a.workType]) || 0;
                                    const amount = sqft * (a.clientRatePerSqft || 0);
                                    return (
                                        <div key={a.workType} className="list-table-format row-item" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1fr' }}>
                                            <p>{a.workType} <span style={{ fontSize: '0.75rem', color: 'var(--text-lt)' }}>(of {a.availableSqft} available)</span></p>
                                            <p>
                                                <input
                                                    type="number" onWheel={e => e.target.blur()} min={0} max={a.availableSqft}
                                                    value={workTypeSqft[a.workType] ?? ''}
                                                    onChange={e => setSqftFor(a.workType, e.target.value)}
                                                    style={{ width: '90px' }}
                                                />
                                            </p>
                                            <p>{a.clientRatePerSqft != null ? `₹${a.clientRatePerSqft}/sqft` : <span title="No Work Type Rate configured">(no rate)</span>}</p>
                                            <p>₹{amount.toLocaleString('en-IN')}</p>
                                        </div>
                                    );
                                })}
                                <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr', fontWeight: 600 }}>
                                    <p>
                                        Total: ₹{totalPreviewAmount.toLocaleString('en-IN')}
                                        {gstRate && ` + GST (${gstRate}%): ₹${(totalPreviewAmount * (Number(gstRate) / 100)).toLocaleString('en-IN')}`}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="edit-modal-actions">
                            <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                            <button type="button" className="add-btn" disabled={!available || available.length === 0 || generating} onClick={confirmGenerate}>
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
                        <h2>GST: Bill #{gstEditItem.billNumber}</h2>
                        <p style={{ margin: '4px 0 16px', color: 'var(--text-lt)', fontSize: '0.9em' }}>
                            Applies to the subtotal of ₹{gstEditItem.totalAmount.toLocaleString('en-IN')}. Leave blank for no GST.
                        </p>
                        <div className="add-product-name flex-col">
                            <p>GST Rate %</p>
                            <input type="number" onWheel={e => e.target.blur()} min="0" value={gstEditValue} onChange={e => setGstEditValue(e.target.value)} autoFocus />
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
                        <p className="bin-confirm-warning">Its measurements become billable again; moved to Recovery Bin.</p>
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
