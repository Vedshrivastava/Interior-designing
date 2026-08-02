import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import StyledSelect from '../../components/finance/StyledSelect';
import StyledDatePicker from '../../components/finance/StyledDatePicker';
import { ACTIVITY_META, DEFAULT_ACTIVITY_META, highlightEntities } from '../../components/finance/DashboardWidgets';
import { useWebSocket } from '../../hooks/useWebSocket';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';
import '../../styles/dashboard.css';

const TABS = [{ key: 'timeline', label: 'Timeline' }];

const EMPTY_FILTERS = { projectId: '', eventType: '', dateFrom: '', dateTo: '' };

// Collapsed-by-default only applies on mobile — desktop always shows the
// full field grid regardless of this state (see the render below). A
// plain window-width check, same 700px breakpoint wizard-field-grid's own
// CSS already switches to a single column at.
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 700px)').matches);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 700px)');
        const handler = (e) => setIsMobile(e.matches);
        if (mq.addEventListener) mq.addEventListener('change', handler); else mq.addListener(handler);
        return () => { if (mq.removeEventListener) mq.removeEventListener('change', handler); else mq.removeListener(handler); };
    }, []);
    return isMobile;
};

const EVENT_TYPES = [
    'measurement_logged', 'stock_dumped', 'stock_returned', 'stock_wasted',
    'running_bill_generated', 'receipt_received', 'contractor_advance_given',
    'contractor_deduction_applied', 'contractor_paid', 'material_purchased',
    'vendor_paid', 'bank_transfer', 'salary_paid', 'commission_paid', 'labour_provider_paid',
    'expense_recorded', 'daily_labour_logged', 'supervisor_incentive_given',
    'work_created', 'work_completed', 'project_created', 'project_activated',
    'client_quotation_issued', 'client_quotation_status_changed',
];
const eventLabel = (et) => et.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const dateKey = (d) => new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
const timeLabel = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/*
 * Real-time feed over financeActivityLog — every logActivity() call made
 * alongside an existing broadcast() across the finance controllers lands
 * here. First finance page in Admin to wire up useWebSocket (every other
 * finance page currently just refetches on its own actions); new entries
 * come from the financeActivityLogged event and are prepended live.
 */
const ActivityTimelinePage = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [mobileOpen, setMobileOpen] = useState(false);
    const isMobile = useIsMobile();

    const activeCount = Object.keys(EMPTY_FILTERS).filter(k => filters[k] !== EMPTY_FILTERS[k]).length;
    // ISO yyyy-mm-dd strings compare correctly lexicographically — no need
    // to parse into Date objects just to check ordering.
    const dateRangeInvalid = !!(filters.dateFrom && filters.dateTo && filters.dateTo < filters.dateFrom);
    const clearAllFilters = () => setFilters(EMPTY_FILTERS);

    const fetchPage = async (pageNum, replace) => {
        setLoading(true);
        try {
            const params = { page: pageNum, limit: 50 };
            if (filters.projectId) params.projectId = filters.projectId;
            if (filters.eventType) params.eventType = filters.eventType;
            if (filters.dateFrom) params.dateFrom = filters.dateFrom;
            if (filters.dateTo) params.dateTo = filters.dateTo;
            const res = await axios.get(`${url}/api/finance/activity/list`, { ...authHeader, params });
            if (res.data.success) {
                setEntries(prev => replace ? res.data.data : [...prev, ...res.data.data]);
                setHasMore(res.data.hasMore);
                setPage(pageNum);
            }
        } catch { toast.error('Error fetching activity log'); }
        finally { setLoading(false); }
    };

    // Filters apply live (no separate "Apply" step) — but never fire a
    // request with a nonsensical date range; the inline error below is
    // what tells the user why nothing happened, instead of silently
    // sending (or silently not sending) a bad query.
    useEffect(() => {
        if (dateRangeInvalid) return;
        fetchPage(1, true);
    }, [filters.projectId, filters.eventType, filters.dateFrom, filters.dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {}).finally(() => setProjectsLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useWebSocket(useCallback((msg) => {
        if (msg.type !== 'financeActivityLogged' || !msg.data) return;
        const entry = msg.data;
        if (filters.projectId && entry.projectId !== filters.projectId) return;
        if (filters.eventType && entry.eventType !== filters.eventType) return;
        setEntries(prev => [entry, ...prev]);
    }, [filters.projectId, filters.eventType]));

    const setField = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

    const grouped = entries.reduce((acc, e) => {
        const key = dateKey(e.timestamp);
        (acc[key] ||= []).push(e);
        return acc;
    }, {});

    return (
        <FinanceTabShell
            label="Activity Timeline"
            subtitle="Chronological log of every write across the finance workspace: who did what, when."
            tabs={TABS}
            activeKey="timeline"
            onTabChange={() => {}}
        >
            {/* Same white/gold-strip card language as every Dashboard card
                (KpiCard, ChartCard) — dash-chart-card, not a bare form grid,
                so filters read as a section of this page rather than a
                leftover wizard step. dash-filter-card overrides overflow
                back to visible: the shared card clips to round its gold
                strip's corners, but StyledSelect/StyledDatePicker render
                their open dropdown/calendar as a plain absolutely-positioned
                child (no portal), so that same clipping was cutting them off
                whenever they'd extend past the card's edge. */}
            <div className="dash-chart-card dash-filter-card" style={{ marginBottom: '24px' }}>
                <div className="dash-filter-head">
                    <div className="dash-filter-head-left">
                        <p className="dash-chart-title">
                            Filters
                            {activeCount > 0 && <span className="dash-filter-badge">{activeCount} active</span>}
                        </p>
                        {activeCount > 0 && (
                            <button type="button" className="dash-filter-clear" onClick={clearAllFilters}>
                                Clear all
                            </button>
                        )}
                    </div>
                    {isMobile && (
                        <button
                            type="button"
                            className="dash-filter-toggle"
                            onClick={() => setMobileOpen(o => !o)}
                            aria-label={mobileOpen ? 'Collapse filters' : 'Expand filters'}
                        >
                            <FontAwesomeIcon icon={mobileOpen ? faChevronUp : faChevronDown} />
                        </button>
                    )}
                </div>

                {(!isMobile || mobileOpen) && (
                    <div className="wizard-field-grid" style={{ marginTop: '16px', marginBottom: 0 }}>
                        <div className="add-product-name flex-col">
                            <p>Project</p>
                            <StyledSelect
                                value={filters.projectId}
                                onChange={v => setField('projectId', v)}
                                placeholder="All Projects"
                                loading={projectsLoading}
                                options={[{ value: '', label: 'All Projects' }, ...projects.map(p => ({ value: p._id, label: p.name }))]}
                            />
                        </div>
                        <div className="add-product-name flex-col">
                            <p>Event Type</p>
                            <StyledSelect
                                value={filters.eventType}
                                onChange={v => setField('eventType', v)}
                                placeholder="All Events"
                                options={[{ value: '', label: 'All Events' }, ...EVENT_TYPES.map(et => ({ value: et, label: eventLabel(et) }))]}
                            />
                        </div>
                        <div className="add-product-name flex-col">
                            <p>From</p>
                            <StyledDatePicker value={filters.dateFrom} onChange={v => setField('dateFrom', v)} />
                        </div>
                        <div className={`add-product-name flex-col${dateRangeInvalid ? ' field-error' : ''}`}>
                            <p>To</p>
                            <StyledDatePicker value={filters.dateTo} onChange={v => setField('dateTo', v)} />
                            {dateRangeInvalid && (
                                <span className="dash-filter-error">&quot;To&quot; date can&apos;t be before &quot;From&quot; date.</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {loading && entries.length === 0 ? (
                <div className="dash-chart-card"><div className="dash-empty">Loading…</div></div>
            ) : entries.length === 0 ? (
                <div className="dash-chart-card"><div className="dash-empty">No activity recorded yet.</div></div>
            ) : (
                Object.entries(grouped).map(([day, items]) => (
                    <div key={day} className="dash-chart-card" style={{ marginBottom: '20px', padding: 0 }}>
                        <p className="dash-activity-date-heading" style={{ padding: '18px 20px 6px' }}>{day}</p>
                        {/* Its own class, not .list-table-format — that class carries a
                            heavy !important mobile transform elsewhere in list.css built
                            for a different row shape (image + title + subtitle + action
                            buttons), which fought this row's own mobile layout via
                            :nth-child positioning regardless of specificity. */}
                        <div className="activity-row activity-row-header">
                            <span /><b>Time</b><b>Activity</b><b>Amount</b>
                        </div>
                        {items.map(e => {
                            const meta = ACTIVITY_META[e.eventType] || DEFAULT_ACTIVITY_META;
                            return (
                                <div key={e._id} className="activity-row">
                                    <span className={`dash-activity-icon at-icon tone-${meta.tone}`}>
                                        <FontAwesomeIcon icon={meta.icon} />
                                    </span>
                                    <p className="at-time">{timeLabel(e.timestamp)}</p>
                                    <p className="at-summary">
                                        {highlightEntities(e.summary, e.entityNames)}
                                        {/* Plain text, not a bordered pill — a pill on every single
                                            row (same actor, most of the time) competed visually with
                                            the entity-name pills/highlights that actually carry new
                                            information per row. */}
                                        {e.performedBy && <span className="activity-performed-by">· {e.performedBy}</span>}
                                    </p>
                                    {/* Empty, not a "–" — a dash read as missing data rather than
                                        "this row has no amount", for the many non-financial rows
                                        (measurements, work/project status, reviews). */}
                                    <p className="at-amount">{e.amount != null ? `₹${e.amount.toLocaleString('en-IN')}` : ''}</p>
                                </div>
                            );
                        })}
                    </div>
                ))
            )}

            {hasMore && (
                <button type="button" className="dash-activity-viewall" onClick={() => fetchPage(page + 1, false)} disabled={loading}>
                    {loading ? 'Loading…' : 'Load More'}
                </button>
            )}
        </FinanceTabShell>
    );
};

export default ActivityTimelinePage;
