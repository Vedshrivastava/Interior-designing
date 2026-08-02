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
 * Rejected pool.
 *
 * WHO's responsible for a Rejected pool used to be a separate, later step
 * in Payables — that gap meant a review could be saved with a real
 * rejected pool nobody ever actually distributed, silently locking every
 * contractor/labourer on the Work out of pay they'd already earned with no
 * visible next step (see financeWorkReview.js's reviewCycle comment for
 * the concrete bug this caused: a stale deduction left over from an
 * earlier rejection could even satisfy a brand new one). Distribution is
 * now part of THIS SAME action — whenever there's a rejected pool, saving
 * requires it to be fully allocated across contractors/labourers first
 * (server-enforced too, see reviewWork), right here in one atomic step.
 * Supervisors stay optional — a flat ₹ amount, not sqft, never part of the
 * attribution gate.
 *
 * The Period From/To picker mirrors RunningBillsManager's own Generate
 * Bill modal exactly — purely descriptive context for "what's likely new
 * since I last reviewed"; review always acts on the Work's true current
 * logged total, not a date-filtered slice.
 *
 * Mounted at Receivables' own Work Review tab — that page already owns a
 * shared project picker across its tabs, so `projectId` arrives as a fixed
 * prop; when omitted this shows its own internal one, same dual-mode
 * pattern used elsewhere in this module (WorkMeasurementsSummary,
 * SiteDiaryManager).
 */
const WorkReviewPanel = ({ url, projectId: fixedProjectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const crossProject = !fixedProjectId;

    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(crossProject);
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

    // Distribution state — only relevant once approvedInput leaves some
    // sqft rejected. Fetched as soon as the modal opens (same as
    // WorkDeductionAllocationPanel's old openAllocate) so the fields are
    // ready the moment a rejection actually appears, no extra round trip.
    const [contractors, setContractors] = useState([]);
    const [labourers, setLabourers] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [loadingParties, setLoadingParties] = useState(false);
    const [sqftInputs, setSqftInputs] = useState({}); // `${partyType}|${partyId}` -> value
    const [amountInputs, setAmountInputs] = useState({}); // employeeId -> value (supervisor, optional)
    const [reason, setReason] = useState('');

    const fetchProjects = () => {
        if (!crossProject) return;
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {}).finally(() => setProjectsLoading(false));
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

    const openReview = async (row) => {
        setReviewTarget(row);
        setApprovedInput(String(row.loggedSqft));
        setReviewDate(new Date().toISOString().slice(0, 10));
        setSqftInputs({}); setAmountInputs({}); setReason('');
        setLoadingParties(true);
        try {
            const [cRes, lRes] = await Promise.all([
                axios.get(`${url}/api/finance/work-contractor-assignments/list`, { ...authHeader, params: { workId: row.workId } }),
                axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { workId: row.workId } }),
            ]);
            setContractors(cRes.data.success ? cRes.data.data : []);
            const labourRows = lRes.data.success ? lRes.data.data : [];
            setLabourers(labourRows);
            const supervisorMap = new Map();
            for (const a of labourRows) {
                if (a.supervisorId?._id) supervisorMap.set(a.supervisorId._id, a.supervisorId.name);
            }
            setSupervisors([...supervisorMap.entries()].map(([employeeId, name]) => ({ employeeId, name })));
        } catch { toast.error('Error fetching workers for this work'); }
        finally { setLoadingParties(false); }
    };
    const closeReview = () => setReviewTarget(null);

    const rejectedPreview = reviewTarget && approvedInput !== '' && !Number.isNaN(Number(approvedInput))
        ? Math.round(((reviewTarget.loggedSqft - Number(approvedInput)) + Number.EPSILON) * 100) / 100
        : null;

    const sqftEnteredTotal = Object.values(sqftInputs).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const remainingToDistribute = rejectedPreview !== null
        ? Math.round(((rejectedPreview - sqftEnteredTotal) + Number.EPSILON) * 100) / 100
        : 0;
    const needsDistribution = rejectedPreview !== null && rejectedPreview > 0;
    const fullyDistributed = !needsDistribution || Math.abs(remainingToDistribute) < 0.01;

    const submitReview = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (approvedInput === '' || Number(approvedInput) < 0) return toast.error('Approved sqft is required');
        if (Number(approvedInput) > reviewTarget.loggedSqft) return toast.error(`Cannot approve more than the ${reviewTarget.loggedSqft} sqft logged`);
        if (!reviewDate) return toast.error('Date is required');
        if (needsDistribution) {
            if (!reason.trim()) return toast.error('Reason is required — this is what went wrong on the rejected sqft');
            if (!fullyDistributed) {
                return toast.error(remainingToDistribute > 0
                    ? `${remainingToDistribute} sqft still left to distribute before this can save`
                    : `${Math.abs(remainingToDistribute)} sqft over-allocated — reduce it back to ${rejectedPreview}`);
            }
        }
        setSaving(true);
        try {
            const allocations = Object.entries(sqftInputs)
                .filter(([, v]) => Number(v) > 0)
                .map(([key, v]) => {
                    const [partyType, partyId] = key.split('|');
                    return { partyType, partyId, areaSqft: Number(v) };
                });
            const supervisorAllocations = Object.entries(amountInputs)
                .filter(([, v]) => Number(v) > 0)
                .map(([employeeId, v]) => ({ employeeId, amount: Number(v) }));
            const res = await axios.post(`${url}/api/finance/work-reviews/review`, {
                workId: reviewTarget.workId, approvedAreaSqft: approvedInput, date: reviewDate,
                reason: reason.trim(), allocations, supervisorAllocations,
            }, authHeader);
            if (res.data.success) { toast.success(res.data.message); closeReview(); await fetchRows(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error saving review'); }
        finally { setSaving(false); }
    };

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>
                Every Work on this project, its logged sqft, and how much of it has been reviewed. Reviewing is what unlocks both Generate Bill's ceiling and every contributing worker's own Approved Earnings — nothing here is billable or payable until it's been looked at. Whenever some of it is rejected, you'll distribute it to whoever's responsible right here before the review can save.
            </p>

            {crossProject && (
                <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                    <p>Project</p>
                    <StyledSelect
                        value={internalProjectId} onChange={setInternalProjectId} placeholder="Select project…" loading={projectsLoading}
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
                        <div className="dash-chart-card wr-card">
                            <div className="wr-row wr-header">
                                <b className="wr-worktype">Work Type</b>
                                <b className="wr-logged">Logged</b>
                                <b className="wr-approved">Approved</b>
                                <b className="wr-rejected">Rejected</b>
                                <b className="wr-pending">Pending Review</b>
                                <b className="wr-action">Action</b>
                            </div>
                            {visibleRows.map(row => (
                                <div key={row.workId} className="wr-row">
                                    <p className="wr-worktype">{row.workType}</p>
                                    <p className="wr-logged"><span className="pq-group-label">Logged</span>{row.loggedSqft} sqft</p>
                                    <p className="wr-approved" style={{ color: row.approvedAreaSqft > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}><span className="pq-group-label">Approved</span>{row.approvedAreaSqft} sqft</p>
                                    <p className="wr-rejected" style={{ color: row.rejectedAreaSqft > 0 ? '#c0392b' : 'var(--text-lt)' }}>
                                        <span className="pq-group-label">Rejected</span>{row.rejectedAreaSqft} sqft
                                        {row.rejectedAreaSqft > 0 && row.unattributedAreaSqft > 0 && (
                                            <span className="admin-subtitle" style={{ display: 'block', fontSize: '0.75em' }}>{row.unattributedAreaSqft} sqft unattributed</span>
                                        )}
                                    </p>
                                    <p className="wr-pending" style={{ color: row.pendingReviewSqft > 0 ? '#b8860b' : 'var(--text-lt)', fontWeight: row.pendingReviewSqft > 0 ? 600 : 400 }}><span className="pq-group-label">Pending Review</span>{row.pendingReviewSqft} sqft</p>
                                    <div className="wr-action">
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
                <div className="submit-loader-overlay wr-overlay" style={{ zIndex: 100000 }}>
                    <div className="loader-modal-box edit-modal wr-modal">
                        <div className="wr-modal-header">
                            <h2>Review — {reviewTarget.workType}</h2>
                        </div>
                        <div className="wr-modal-body">
                            <form id="work-review-form" onSubmit={submitReview}>
                                <p className="admin-subtitle" style={{ margin: '0 0 16px' }}>
                                    {reviewTarget.loggedSqft} sqft logged in total. Enter how much is approved — whatever's left becomes a rejected pool you'll distribute below before this can save.
                                </p>
                                <div className="wizard-field-grid">
                                    <div className="add-product-name flex-col">
                                        <p>Approved Sqft * (of {reviewTarget.loggedSqft})</p>
                                        <input type="number" onWheel={e => e.target.blur()} min="0" step="any" max={reviewTarget.loggedSqft} value={approvedInput} onChange={e => setApprovedInput(e.target.value)} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Date *</p>
                                        <StyledDatePicker value={reviewDate} onChange={setReviewDate} />
                                    </div>
                                </div>
                                {rejectedPreview !== null && (
                                    <p className="admin-subtitle" style={{ marginTop: '8px', color: rejectedPreview > 0 ? '#c0392b' : 'var(--moss)' }}>
                                        {rejectedPreview > 0 ? `${rejectedPreview} sqft will be rejected — distribute it below.` : 'Everything logged will be approved.'}
                                    </p>
                                )}

                                {needsDistribution && !loadingParties && (
                                    <div style={{
                                        margin: '12px 0', padding: '10px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem',
                                        textAlign: 'center',
                                        background: fullyDistributed ? 'rgba(46,139,87,0.12)' : 'rgba(192,57,43,0.12)',
                                        color: fullyDistributed ? 'var(--moss)' : '#c0392b',
                                        border: `1px solid ${fullyDistributed ? 'var(--moss)' : '#c0392b'}`,
                                    }}>
                                        {fullyDistributed
                                            ? '✓ Fully distributed'
                                            : remainingToDistribute > 0
                                                ? `${remainingToDistribute} sqft still left to distribute`
                                                : `${Math.abs(remainingToDistribute)} sqft over-allocated — reduce it back to ${rejectedPreview}`}
                                    </div>
                                )}

                                {needsDistribution && (
                                    loadingParties ? (
                                        <div className="admin-empty-state"><p>Loading…</p></div>
                                    ) : (
                                        <>
                                            <div className="dash-chart-card wrd-card" style={{ margin: '12px 0' }}>
                                                <div className="wrd-row wrd-header">
                                                    <b className="wrd-name">Name</b><b className="wrd-type">Type</b><b className="wrd-value">Sqft to Deduct</b>
                                                </div>
                                                {contractors.map(a => {
                                                    const key = `contractor|${a.contractorVendorId._id}`;
                                                    return (
                                                        <div key={key} className="wrd-row">
                                                            <p className="wrd-name">{a.contractorVendorId?.name || '—'}</p>
                                                            <p className="wrd-type"><span className="item-category">Contractor</span></p>
                                                            <p className="wrd-value"><input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={sqftInputs[key] || ''} onChange={e => setSqftInputs(p => ({ ...p, [key]: e.target.value }))} /></p>
                                                        </div>
                                                    );
                                                })}
                                                {[...new Map(labourers.map(a => [a.labourerId._id, a])).values()].map(a => {
                                                    const key = `labour|${a.labourerId._id}`;
                                                    return (
                                                        <div key={key} className="wrd-row">
                                                            <p className="wrd-name">{a.labourerId?.name || '—'}</p>
                                                            <p className="wrd-type"><span className="item-category">Labour</span></p>
                                                            <p className="wrd-value"><input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={sqftInputs[key] || ''} onChange={e => setSqftInputs(p => ({ ...p, [key]: e.target.value }))} /></p>
                                                        </div>
                                                    );
                                                })}
                                                {contractors.length === 0 && labourers.length === 0 && (
                                                    <div className="admin-empty-state"><p>No contractors or labourers assigned to this work — cannot distribute the rejected sqft, so this review can't be saved.</p></div>
                                                )}
                                            </div>

                                            {supervisors.length > 0 && (
                                                <div className="dash-chart-card wrd-card" style={{ marginBottom: '12px' }}>
                                                    <div className="wrd-row wrd-header">
                                                        <b className="wrd-name">Name</b><b className="wrd-type">Type</b><b className="wrd-value">₹ to Deduct (optional)</b>
                                                    </div>
                                                    {supervisors.map(s => (
                                                        <div key={s.employeeId} className="wrd-row">
                                                            <p className="wrd-name">{s.name}</p>
                                                            <p className="wrd-type"><span className="item-category">Supervisor</span></p>
                                                            <p className="wrd-value"><input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={amountInputs[s.employeeId] || ''} onChange={e => setAmountInputs(p => ({ ...p, [s.employeeId]: e.target.value }))} /></p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <p className="admin-subtitle" style={{ marginBottom: '12px', fontWeight: 600, color: fullyDistributed ? 'var(--moss)' : '#c0392b' }}>
                                                {fullyDistributed ? 'Fully distributed' : remainingToDistribute > 0 ? `${remainingToDistribute} sqft still left to distribute` : `${Math.abs(remainingToDistribute)} sqft over-allocated`}
                                            </p>

                                            <div className="add-product-name flex-col wizard-field-full" style={{ marginBottom: '8px' }}>
                                                <p>Reason *</p>
                                                <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="What went wrong" />
                                            </div>
                                        </>
                                    )
                                )}
                            </form>
                        </div>

                        <div className="edit-modal-actions wr-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={closeReview}>Cancel</button>
                            <button type="submit" form="work-review-form" className="add-btn" disabled={saving || loadingParties || (needsDistribution && !fullyDistributed)}>{saving ? 'Saving…' : 'Save Review'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default WorkReviewPanel;
