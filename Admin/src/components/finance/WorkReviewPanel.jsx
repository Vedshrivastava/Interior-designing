import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

/*
 * "Approved" throughout Finance now means reviewed — sqft an engineer has
 * actually looked at and confirmed, not merely logged (see
 * financeReports.js's computeWorkApprovedBilling). This is where that
 * review happens, one Work at a time: how much of everything logged on it
 * is genuinely done well. Whatever's left over automatically becomes the
 * Rejected pool — a single number to enter, not two separate actions.
 * Reviewing here is what unlocks both Generate Bill's ceiling for that
 * work AND every contributing worker's own Approved Earnings (split
 * proportionally to their share, same as this codebase already does for
 * multi-party Works elsewhere).
 *
 * WHO specifically is responsible for a Rejected pool is a deliberately
 * separate decision, made in Payables — that flow allocates the pool
 * across specific contractors/labourers/supervisors, which is what
 * actually reduces any one person's own pay (via the existing
 * financeContractorDeduction/financeLabourDeduction/
 * financeSupervisorDeduction records) — reviewing here never touches
 * anyone's pay directly.
 *
 * The Period From/To picker mirrors RunningBillsManager's own Generate
 * Bill modal exactly — purely descriptive context for "what's likely new
 * since I last reviewed"; review always acts on the Work's true current
 * logged total, not a date-filtered slice.
 *
 * Mounted in two places off this same component:
 *   - Receivables' own new tab — that page already owns a shared project
 *     picker across its tabs, so `projectId` arrives as a fixed prop.
 *   - Payables → Deductions tab — no page-level picker there, so when
 *     `projectId` is omitted this shows its own internal one, same
 *     dual-mode pattern already used elsewhere in this module
 *     (WorkMeasurementsSummary, SiteDiaryManager).
 */
const WorkReviewPanel = ({ url, projectId: fixedProjectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const crossProject = !fixedProjectId;

    const [projects, setProjects] = useState([]);
    const [internalProjectId, setInternalProjectId] = useState('');
    const projectId = fixedProjectId || internalProjectId;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');

    const [workStartDate, setWorkStartDate] = useState('');
    const [lastBillFromDate, setLastBillFromDate] = useState('');
    const [periodFromChoice, setPeriodFromChoice] = useState('lastBill');
    const [periodTo, setPeriodTo] = useState('');

    const [reviewTarget, setReviewTarget] = useState(null);
    const [approvedInput, setApprovedInput] = useState('');
    const [reviewDate, setReviewDate] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchProjects = () => {
        if (!crossProject) return;
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    };
    useEffect(fetchProjects, [url, crossProject]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    const fetchRows = async () => {
        if (!projectId) { setRows([]); setLoading(false); return; }
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/work-reviews/project/${projectId}`, authHeader);
            if (res.data.success) setRows(res.data.data.rows);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching work reviews'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchRows(); }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeWorkReviewChanged', 'financeMeasurementsChanged', 'financeLabourMeasurementsChanged'], fetchRows);

    // Same two-anchor Period From logic as Generate Bill — purely
    // descriptive here too, context for what's likely new to review.
    useEffect(() => {
        if (!projectId) return;
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
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps
    const periodFrom = (periodFromChoice === 'lastBill' && lastBillFromDate) ? lastBillFromDate : workStartDate;

    const visibleRows = statusFilter === 'pending' ? rows.filter(r => r.pendingReviewSqft > 0)
        : statusFilter === 'reviewed' ? rows.filter(r => r.pendingReviewSqft <= 0)
        : rows;

    const openReview = (row) => {
        setReviewTarget(row);
        setApprovedInput(String(row.loggedSqft));
        setReviewDate(new Date().toISOString().slice(0, 10));
    };
    const closeReview = () => setReviewTarget(null);

    const submitReview = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (approvedInput === '' || Number(approvedInput) < 0) return toast.error('Approved sqft is required');
        if (Number(approvedInput) > reviewTarget.loggedSqft) return toast.error(`Cannot approve more than the ${reviewTarget.loggedSqft} sqft logged`);
        if (!reviewDate) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/work-reviews/review`, {
                workId: reviewTarget.workId, approvedAreaSqft: approvedInput, date: reviewDate,
            }, authHeader);
            if (res.data.success) { toast.success(res.data.message); closeReview(); await fetchRows(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error saving review'); }
        finally { setSaving(false); }
    };

    const rejectedPreview = reviewTarget && approvedInput !== '' && !Number.isNaN(Number(approvedInput))
        ? Math.round(((reviewTarget.loggedSqft - Number(approvedInput)) + Number.EPSILON) * 100) / 100
        : null;

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>
                Every Work on this project, its logged sqft, and how much of it has been reviewed. Reviewing is what unlocks both Generate Bill's ceiling and every contributing worker's own Approved Earnings — nothing here is billable or payable until it's been looked at. Who's responsible for any rejected portion gets sorted out separately, in Payables.
            </p>

            {crossProject && (
                <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                    <p>Project</p>
                    <StyledSelect
                        value={internalProjectId} onChange={setInternalProjectId} placeholder="Select project…"
                        options={projects.map(p => ({ value: p._id, label: p.name }))}
                    />
                </div>
            )}

            {!projectId ? (
                <div className="admin-empty-state"><p>Select a project to review its work.</p></div>
            ) : (
                <>
                    <div className="wizard-field-grid" style={{ marginBottom: '20px' }}>
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
                            <StyledDatePicker value={periodTo} onChange={setPeriodTo} />
                        </div>
                        <div className="add-product-name flex-col">
                            <p>Show</p>
                            <StyledSelect
                                value={statusFilter} onChange={setStatusFilter} placeholder="All Rows"
                                options={[{ value: 'pending', label: 'Pending Review Only' }, { value: 'reviewed', label: 'Reviewed Only' }]}
                            />
                        </div>
                    </div>
                    {periodFrom && (
                        <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                            Reviewing period {new Date(periodFrom).toLocaleDateString()}{periodTo ? ` – ${new Date(periodTo).toLocaleDateString()}` : ' – present'} (context only — review always acts on the Work's true current total, same as a bill's own Period From/To).
                        </p>
                    )}

                    {loading ? (
                        <div className="admin-empty-state"><p>Loading…</p></div>
                    ) : visibleRows.length === 0 ? (
                        <div className="admin-empty-state"><p>{rows.length === 0 ? 'No works on this project yet.' : 'Nothing matches this filter.'}</p></div>
                    ) : (
                        <div className="list-table">
                            <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 0.9fr 0.9fr 0.9fr 1fr 150px' }}>
                                <b>Work Type</b><b>Logged</b><b>Approved</b><b>Rejected</b><b>Pending Review</b><b>Action</b>
                            </div>
                            {visibleRows.map(row => (
                                <div key={row.workId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 0.9fr 0.9fr 0.9fr 1fr 150px' }}>
                                    <p>{row.workType}</p>
                                    <p>{row.loggedSqft} sqft</p>
                                    <p style={{ color: row.approvedAreaSqft > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}>{row.approvedAreaSqft} sqft</p>
                                    <p style={{ color: row.rejectedAreaSqft > 0 ? '#c0392b' : 'var(--text-lt)' }}>
                                        {row.rejectedAreaSqft} sqft
                                        {row.rejectedAreaSqft > 0 && row.unattributedAreaSqft > 0 && (
                                            <span className="admin-subtitle" style={{ display: 'block', fontSize: '0.75em' }}>{row.unattributedAreaSqft} sqft unattributed</span>
                                        )}
                                    </p>
                                    <p style={{ color: row.pendingReviewSqft > 0 ? '#b8860b' : 'var(--text-lt)', fontWeight: row.pendingReviewSqft > 0 ? 600 : 400 }}>{row.pendingReviewSqft} sqft</p>
                                    <div className="action-buttons">
                                        {row.pendingReviewSqft > 0 ? (
                                            <p onClick={() => openReview(row)} className="cursor edit-action">Review</p>
                                        ) : (
                                            <span className="item-category" style={{ color: 'var(--moss)' }}>✓ Reviewed</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {reviewTarget && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Review — {reviewTarget.workType}</h2>
                        <p className="admin-subtitle" style={{ margin: '4px 0 16px' }}>
                            {reviewTarget.loggedSqft} sqft logged in total. Enter how much is approved — whatever's left becomes a rejected pool that Payables will later attribute to whoever's responsible.
                        </p>
                        <form onSubmit={submitReview}>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Approved Sqft * (of {reviewTarget.loggedSqft})</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" max={reviewTarget.loggedSqft} value={approvedInput} onChange={e => setApprovedInput(e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Date *</p>
                                    <StyledDatePicker value={reviewDate} onChange={setReviewDate} />
                                </div>
                            </div>
                            {rejectedPreview !== null && (
                                <p className="admin-subtitle" style={{ marginTop: '8px', color: rejectedPreview > 0 ? '#c0392b' : 'var(--moss)' }}>
                                    {rejectedPreview > 0 ? `${rejectedPreview} sqft will be rejected.` : 'Everything logged will be approved.'}
                                </p>
                            )}
                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={closeReview}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save Review'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default WorkReviewPanel;
