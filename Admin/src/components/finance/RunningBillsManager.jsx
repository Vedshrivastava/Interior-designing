import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import { useFileDownload } from '../../hooks/useFileDownload';
import DownloadButton from './DownloadButton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faCheck, faRotateLeft, faPercent, faFileArrowDown } from '@fortawesome/free-solid-svg-icons';
import { measurementUnitLabel } from '../../config/financeMasters';
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
 *
 * rb-row/rb-header: main bill list mobile card hooks.
 * rbg-overlay/rbg-modal: "+ Generate Bill" bottom sheet; rbg-row is the
 * mobile card hook for the nested "available work" table inside it.
 * rbgst-overlay/rbgst-modal: GST edit bottom sheet.
 * Delete confirm stays on bin-confirm-modal — already fluid-width
 * (min(420px,92vw)), no change needed.
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
    const [available, setAvailable] = useState(null);
    const [loadingAvailable, setLoadingAvailable] = useState(false);
    const [workTypeSqft, setWorkTypeSqft] = useState({});
    const [generating, setGenerating] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [gstEditItem, setGstEditItem] = useState(null);
    // One rate per work type present on the bill being edited, not one
    // flat number — { [workType]: ratePercent }, mirrors workTypeSqft's
    // own shape.
    const [gstEditRates, setGstEditRates] = useState({});
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
            const unitByType = new Map();
            for (const row of res.data.data.rows) {
                if (row.pendingReviewSqft <= 0) continue;
                byType.set(row.workType, (byType.get(row.workType) || 0) + row.pendingReviewSqft);
                unitByType.set(row.workType, row.unit || 'sqft');
            }
            setPendingReviewByType([...byType.entries()].map(([workType, sqft]) => ({ workType, sqft: Math.round((sqft + Number.EPSILON) * 100) / 100, unit: unitByType.get(workType) })));
        } catch { /* non-critical — banner just stays empty */ }
    };

    useEffect(() => { if (projectId) { fetchBills(); fetchPendingReview(); } }, [projectId, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const openGenerate = () => {
        setWorkStartDate(''); setLastBillFromDate(''); setPeriodFromChoice('lastBill');
        setPeriodTo(''); setBillDate(new Date().toISOString().slice(0, 10));
        setAvailable(null); setWorkTypeSqft({});
        setModalOpen(true);
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
    // Per work type, not one flat number — mirrors what generateRunningBill
    // actually computes server-side (each work type's own gstRatePercent,
    // resolved from its Work Type Rate or the company default), so this
    // preview can't drift from what the bill actually gets generated with.
    const totalPreviewGst = (available || []).reduce((sum, a) => {
        const sqft = Number(workTypeSqft[a.workType]) || 0;
        const amount = sqft * (a.clientRatePerSqft || 0);
        return sum + (a.gstRatePercent != null ? amount * (a.gstRatePercent / 100) : 0);
    }, 0);

    const confirmGenerate = async () => {
        const payloadSqft = Object.fromEntries(
            Object.entries(workTypeSqft).filter(([, v]) => Number(v) > 0).map(([wt, v]) => [wt, Number(v)])
        );
        if (!Object.keys(payloadSqft).length) return toast.error('Enter an approved quantity for at least one work type');
        setGenerating(true);
        try {
            const res = await axios.post(`${url}/api/finance/running-bills/generate`, { projectId, periodFrom, periodTo, billDate, workTypeSqft: payloadSqft }, authHeader);
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

    // One rate per work type present on the bill, prefilled from whatever
    // each line item is currently carrying — a bill can have more than one
    // line item for the same work type (split across Works), so this
    // collapses to one entry per distinct work type.
    const openGstEdit = (bill) => {
        const rates = {};
        for (const li of bill.lineItems) rates[li.workType] = li.gstRatePercent ?? '';
        setGstEditRates(rates);
        setGstEditItem(bill);
    };
    const setGstEditRate = (workType, value) => setGstEditRates(prev => ({ ...prev, [workType]: value }));

    const gstEditTotal = gstEditItem ? gstEditItem.lineItems.reduce((sum, li) => {
        const rate = gstEditRates[li.workType];
        return sum + (rate !== '' && rate != null ? li.amount * (Number(rate) / 100) : 0);
    }, 0) : 0;

    const saveGst = async () => {
        setSavingGst(true);
        try {
            const res = await axios.post(`${url}/api/finance/running-bills/update-gst`, { _id: gstEditItem._id, lineItemGstRates: gstEditRates }, authHeader);
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
            <div className="rb-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <h3 style={{ margin: '0 0 4px' }}>Running Bills</h3>
                    <p className="admin-subtitle" style={{ margin: 0 }}>Quantity is manually confirmed per work type at generation, in that type's own unit: draft until issued; only issued bills count as revenue or approved work.</p>
                </div>
                <button type="button" className="add-point-btn" style={{ whiteSpace: 'nowrap' }} onClick={openGenerate}>+ Generate Bill</button>
            </div>

            {pendingReviewByType.length > 0 && (
                <div className="admin-subtitle" style={{ background: '#fdf6e3', border: '1px solid #e8d9a8', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#8a6d1f' }}>
                    {pendingReviewByType.map(p => `${p.sqft} ${measurementUnitLabel(p.unit).toLowerCase()} of ${p.workType}`).join(', ')} logged but not yet reviewed — review it in Payables/Receivables → Deductions before it can be billed.
                </div>
            )}

            <div className="list-table finance-table">
                <div className="list-table-format title rb-row rb-header" style={{ gridTemplateColumns: '0.7fr 1fr 1.3fr 1.3fr 110px' }}>
                    <b className="rb-num">Bill #</b><b className="rb-date">Date</b><b className="rb-period">Period</b><b className="rb-total">Total</b><b className="rb-status">Status</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : bills.length === 0 ? (
                    <div className="admin-empty-state"><p>No bills yet.</p></div>
                ) : (
                    bills.map(b => (
                        <div key={b._id} className="list-table-format row-item rb-row" style={{ gridTemplateColumns: '0.7fr 1fr 1.3fr 1.3fr 110px' }}>
                            <p className="rb-num">#{b.billNumber}</p>
                            <p className="rb-date">{new Date(b.billDate).toLocaleDateString()}</p>
                            <p className="rb-period"><span className="rb-field-label">Period</span>{new Date(b.periodFrom).toLocaleDateString()} – {new Date(b.periodTo).toLocaleDateString()}</p>
                            <p className="rb-total">
                                ₹{b.totalAmount.toLocaleString('en-IN')}
                                {b.gstAmount
                                    ? (() => {
                                        // More than one distinct rate across this bill's
                                        // line items shows the blended % with a hint,
                                        // rather than implying one flat rate applied.
                                        const rates = [...new Set(b.lineItems.filter(li => li.gstAmount).map(li => li.gstRatePercent))];
                                        return rates.length > 1
                                            ? ` + GST (${rates.join('/')}% blended): ₹${b.gstAmount.toLocaleString('en-IN')}`
                                            : ` + GST (${b.gstRate}%)`;
                                    })()
                                    : (b.status === 'issued' && (
                                        <span title="Mark this bill Draft to add GST; it's locked once issued." style={{ color: 'var(--text-lt)', fontSize: '0.85em' }}> · no GST</span>
                                    ))}
                            </p>
                            <p className="rb-status" style={{ color: b.status === 'issued' ? 'var(--moss)' : 'var(--text-lt)' }}>
                                <span className="item-category">{STATUS_LABEL[b.status]}</span>
                            </p>
                            {/* Actions live outside the 5-column info grid entirely —
                                a single fixed-width "Action" column can't hold up to 5
                                buttons without either wrapping unpredictably or forcing
                                Bill/Date/Period/Total down to unreadable widths. One row,
                                spanning the full row width (rb-actions-row1, see CSS):
                                routine actions (Issue/Mark Draft, GST, Statement, B&W)
                                left-anchored, delete pinned to the far right via its own
                                auto margin — set apart by the gap, no divider needed. */}
                            <div className="rb-actions-row1">
                                {/* Issue is the primary desired action on a draft bill
                                    (same weight as Quotations' Accept), so it's promoted
                                    to a solid button; Mark Draft is a reversal, not a
                                    forward step, so it stays an outline pill with the
                                    same faRotateLeft icon Quotations' own Reopen uses for
                                    the same reason. */}
                                {b.status === 'draft' ? (
                                    <button type="button" onClick={() => toggleStatus(b)} className="cursor pq-btn-accept rb-btn">
                                        <FontAwesomeIcon icon={faCheck} className="pq-action-icon" /> Issue
                                    </button>
                                ) : (
                                    <p onClick={() => toggleStatus(b)} className="cursor edit-action rb-btn">
                                        <FontAwesomeIcon icon={faRotateLeft} className="pq-action-icon" /> Mark Draft
                                    </p>
                                )}
                                {b.status === 'draft' && (
                                    <p onClick={() => openGstEdit(b)} className="cursor edit-action rb-btn">
                                        <FontAwesomeIcon icon={faPercent} className="pq-action-icon" /> GST
                                    </p>
                                )}
                                <DownloadButton
                                    as="p" downloading={downloadingKey === `${b._id}:color`} progress={downloadingKey === `${b._id}:color` ? downloadProgress : null}
                                    idleLabel="Statement" icon={<FontAwesomeIcon icon={faFileArrowDown} className="pq-action-icon" />}
                                    onClick={() => downloadStatement(b, 'color')} className="cursor edit-action rb-btn"
                                />
                                <DownloadButton
                                    as="p" downloading={downloadingKey === `${b._id}:bw`} progress={downloadingKey === `${b._id}:bw` ? downloadProgress : null}
                                    idleLabel="B&W" icon={<FontAwesomeIcon icon={faFileArrowDown} className="pq-action-icon" />}
                                    onClick={() => downloadStatement(b, 'bw')} className="cursor edit-action rb-btn"
                                />
                                <button type="button" onClick={() => setConfirmItem(b)} className="pq-btn-ghost-danger rb-delete-btn" title="Remove bill" aria-label="Remove bill">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay rbg-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal rbg-modal" style={{ maxWidth: '660px' }}>
                        <div className="rbg-modal-header">
                            <h2>Generate Running Bill</h2>
                            <p className="admin-subtitle" style={{ margin: '4px 0 16px' }}>
                                Sqft below is pre-filled with everything logged and not yet approved; edit it down to what you're actually confirming for each work type. The ₹ amount is always derived from the configured rate.
                            </p>
                        </div>

                        <div className="rbg-modal-body">
                            <form id="generate-bill-form" onSubmit={e => { e.preventDefault(); confirmGenerate(); }}>
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
                                </div>

                                {loadingAvailable ? (
                                    <div className="admin-empty-state" style={{ margin: '16px 0' }}><p>Loading available work…</p></div>
                                ) : !available || available.length === 0 ? (
                                    <div className="admin-empty-state" style={{ margin: '16px 0' }}><p>Nothing reviewed and ready to bill for this project right now — review logged work first (Payables/Receivables → Work Review).</p></div>
                                ) : (
                                    <div className="list-table finance-table" style={{ margin: '16px 0' }}>
                                        <div className="list-table-format title rbg-row rbg-header" style={{ gridTemplateColumns: '1.1fr 0.9fr 0.9fr 0.7fr 1fr' }}>
                                            <b>Work Type</b><b>Approved Qty</b><b>Rate</b><b>GST %</b><b>Amount</b>
                                        </div>
                                        {available.map(a => {
                                            const sqft = Number(workTypeSqft[a.workType]) || 0;
                                            const amount = sqft * (a.clientRatePerSqft || 0);
                                            const unitLabel = measurementUnitLabel(a.unit);
                                            return (
                                                <div key={a.workType} className="list-table-format row-item rbg-row" style={{ gridTemplateColumns: '1.1fr 0.9fr 0.9fr 0.7fr 1fr' }}>
                                                    <p className="rbg-worktype">{a.workType} <span style={{ fontSize: '0.75rem', color: 'var(--text-lt)' }}>(of {a.availableSqft} {unitLabel} available)</span></p>
                                                    <p className="rbg-sqft">
                                                        <input
                                                            type="number" onWheel={e => e.target.blur()} min={0} step="any" max={a.availableSqft}
                                                            value={workTypeSqft[a.workType] ?? ''}
                                                            onChange={e => setSqftFor(a.workType, e.target.value)}
                                                            style={{ width: '90px' }}
                                                        />
                                                        <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: 'var(--text-lt)' }}>{unitLabel}</span>
                                                    </p>
                                                    <p className="rbg-rate">{a.clientRatePerSqft != null ? `₹${a.clientRatePerSqft}/${unitLabel}` : <span title="No Work Type Rate configured">(no rate)</span>}</p>
                                                    <p className="rbg-gst" title="From this work type's own Work Type Rate, or the company default from Settings → GST">
                                                        {a.gstRatePercent != null ? `${a.gstRatePercent}%` : '—'}
                                                    </p>
                                                    <p className="rbg-amount">₹{amount.toLocaleString('en-IN')}</p>
                                                </div>
                                            );
                                        })}
                                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr', fontWeight: 600 }}>
                                            <p>
                                                Total: ₹{totalPreviewAmount.toLocaleString('en-IN')}
                                                {totalPreviewGst > 0 && ` + GST: ₹${totalPreviewGst.toLocaleString('en-IN')}`}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>

                        <div className="edit-modal-actions rbg-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                            <button type="submit" form="generate-bill-form" className="add-btn" disabled={!available || available.length === 0 || generating}>
                                {generating ? 'Generating…' : <><FontAwesomeIcon icon={faCheck} className="pq-action-icon" /> Confirm & Generate</>}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {gstEditItem && ReactDOM.createPortal(
                <div className="submit-loader-overlay rbgst-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal rbgst-modal" style={{ maxWidth: '420px' }}>
                        <div className="rbgst-modal-header">
                            <h2>GST: Bill #{gstEditItem.billNumber}</h2>
                            <p style={{ margin: '4px 0 16px', color: 'var(--text-lt)', fontSize: '0.9em' }}>
                                One rate per work type — a bill mixing e.g. a material claim and a labour/service claim can be taxed differently for each. Leave a row blank for no GST on that work type.
                            </p>
                        </div>

                        <div className="rbgst-modal-body">
                            <form id="gst-edit-form" onSubmit={e => { e.preventDefault(); saveGst(); }}>
                                {[...new Map(gstEditItem.lineItems.map(li => [li.workType, li])).values()].map(li => (
                                    <div key={li.workType} className="add-product-name flex-col" style={{ marginBottom: '10px' }}>
                                        <p>{li.workType} <span style={{ fontSize: '0.75rem', color: 'var(--text-lt)' }}>(subtotal ₹{gstEditItem.lineItems.filter(x => x.workType === li.workType).reduce((s, x) => s + x.amount, 0).toLocaleString('en-IN')})</span></p>
                                        <input
                                            type="number" onWheel={e => e.target.blur()} min="0" step="any"
                                            value={gstEditRates[li.workType] ?? ''} onChange={e => setGstEditRate(li.workType, e.target.value)}
                                        />
                                    </div>
                                ))}
                                <p style={{ margin: '12px 0 0', fontWeight: 600 }}>
                                    Grand Total: ₹{(gstEditItem.totalAmount + gstEditTotal).toLocaleString('en-IN')}
                                    {gstEditTotal > 0 && <span style={{ fontWeight: 400, color: 'var(--text-lt)' }}> (incl. ₹{gstEditTotal.toLocaleString('en-IN')} GST)</span>}
                                </p>
                            </form>
                        </div>

                        <div className="edit-modal-actions rbgst-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setGstEditItem(null)}>Cancel</button>
                            <button type="submit" form="gst-edit-form" className="add-btn" disabled={savingGst}>
                                {savingGst ? 'Saving…' : <><FontAwesomeIcon icon={faCheck} className="pq-action-icon" /> Save</>}
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
