import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import { useWebSocket } from '../../hooks/useWebSocket';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const TABS = [{ key: 'timeline', label: 'Timeline' }];

const EVENT_TYPES = [
    'measurement_logged', 'stock_dumped', 'stock_returned', 'stock_wasted',
    'running_bill_generated', 'receipt_received', 'contractor_advance_given',
    'contractor_deduction_applied', 'contractor_paid', 'material_purchased',
    'vendor_paid', 'bank_transfer', 'salary_paid', 'commission_paid',
    'expense_recorded', 'daily_labour_logged', 'supervisor_incentive_given',
    'work_created', 'work_completed', 'project_created', 'project_activated',
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
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [filters, setFilters] = useState({ projectId: '', eventType: '', dateFrom: '', dateTo: '' });

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

    useEffect(() => { fetchPage(1, true); }, [filters.projectId, filters.eventType, filters.dateFrom, filters.dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
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
            subtitle="Chronological log of every write across the finance workspace — who did what, when."
            tabs={TABS}
            activeKey="timeline"
            onTabChange={() => {}}
        >
            <div className="wizard-field-grid" style={{ marginBottom: '20px' }}>
                <div className="add-product-name flex-col">
                    <p>Project</p>
                    <select value={filters.projectId} onChange={e => setField('projectId', e.target.value)}>
                        <option value="">All Projects</option>
                        {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                </div>
                <div className="add-product-name flex-col">
                    <p>Event Type</p>
                    <select value={filters.eventType} onChange={e => setField('eventType', e.target.value)}>
                        <option value="">All Events</option>
                        {EVENT_TYPES.map(et => <option key={et} value={et}>{eventLabel(et)}</option>)}
                    </select>
                </div>
                <div className="add-product-name flex-col">
                    <p>From</p>
                    <input type="date" value={filters.dateFrom} onChange={e => setField('dateFrom', e.target.value)} />
                </div>
                <div className="add-product-name flex-col">
                    <p>To</p>
                    <input type="date" value={filters.dateTo} onChange={e => setField('dateTo', e.target.value)} />
                </div>
            </div>

            {loading && entries.length === 0 ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : entries.length === 0 ? (
                <div className="admin-empty-state"><p>No activity recorded yet.</p></div>
            ) : (
                Object.entries(grouped).map(([day, items]) => (
                    <div key={day} style={{ marginBottom: '28px' }}>
                        <p className="activity-date-heading">{day}</p>
                        <div className="list-table">
                            <div className="list-table-format title" style={{ gridTemplateColumns: '80px 1fr 140px' }}>
                                <b>Time</b><b>Activity</b><b>Amount</b>
                            </div>
                            {items.map(e => (
                                <div key={e._id} className="list-table-format row-item" style={{ gridTemplateColumns: '80px 1fr 140px' }}>
                                    <p>{timeLabel(e.timestamp)}</p>
                                    <p>
                                        {e.summary}
                                        {e.performedBy && <span className="item-category" style={{ marginLeft: '8px' }}>{e.performedBy}</span>}
                                    </p>
                                    <p>{e.amount != null ? `₹${e.amount.toLocaleString('en-IN')}` : '—'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}

            {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button className="add-btn" onClick={() => fetchPage(page + 1, false)} disabled={loading}>
                        {loading ? 'Loading…' : 'Load More'}
                    </button>
                </div>
            )}
        </FinanceTabShell>
    );
};

export default ActivityTimelinePage;
