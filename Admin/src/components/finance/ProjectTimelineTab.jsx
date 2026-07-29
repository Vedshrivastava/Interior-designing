import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ACTIVITY_META, DEFAULT_ACTIVITY_META, highlightEntities } from './DashboardWidgets';
import { useWebSocket } from '../../hooks/useWebSocket';
import '../../styles/list.css';
import '../../styles/dashboard.css';

const dateKey = (d) => new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
const timeLabel = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/*
 * Chronological activity log scoped to one project — mirrors
 * ActivityTimelinePage.jsx's day-grouped row rendering exactly (same
 * dash-chart-card/dash-activity-date-heading/activity-row/at-* classes,
 * same per-event icon + tone from ACTIVITY_META, same entity-name
 * highlighting) for visual parity (deliberately a separate component,
 * not an extraction: that page is already shipped/in active use and its
 * fetch/filter/websocket logic isn't cleanly separated from render, so
 * extracting risks regressing a working page for a small amount of
 * shared logic). No filter UI here — the project itself is already the
 * fixed scope. .activity-row is its own class rather than a reuse of
 * .list-table-format deliberately — see that page's own comment on why
 * (the generic ≤480px .list-table-format mobile transform, built for an
 * image+title+subtitle+actions row shape, hijacked this row's layout
 * regardless of override specificity). Already has a full ≤700px mobile
 * treatment (dashboard.css) — nothing new needed here, just reusing it.
 *
 * No dialogue modal here — this tab is read-only (an activity log, not
 * something you add/edit entries into directly).
 */
const ProjectTimelineTab = ({ url, projectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const fetchPage = useCallback(async (pageNum, replace) => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/activity/list`, { ...authHeader, params: { projectId, page: pageNum, limit: 50 } });
            if (res.data.success) {
                setEntries(prev => replace ? res.data.data : [...prev, ...res.data.data]);
                setHasMore(res.data.hasMore);
                setPage(pageNum);
            }
        } catch { toast.error('Error fetching activity log'); }
        finally { setLoading(false); }
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchPage(1, true); }, [fetchPage]);

    useWebSocket(useCallback((msg) => {
        if (msg.type !== 'financeActivityLogged' || !msg.data) return;
        if (msg.data.projectId !== projectId) return;
        setEntries(prev => [msg.data, ...prev]);
    }, [projectId]));

    const grouped = entries.reduce((acc, e) => {
        const key = dateKey(e.timestamp);
        (acc[key] ||= []).push(e);
        return acc;
    }, {});

    return (
        <div>
            {loading && entries.length === 0 ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : entries.length === 0 ? (
                <div className="admin-empty-state"><p>No activity recorded yet for this project.</p></div>
            ) : (
                Object.entries(grouped).map(([day, items]) => (
                    <div key={day} className="dash-chart-card" style={{ marginBottom: '20px', padding: 0 }}>
                        <p className="dash-activity-date-heading" style={{ padding: '18px 20px 6px' }}>{day}</p>
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
                                        {e.performedBy && <span className="activity-performed-by">· {e.performedBy}</span>}
                                    </p>
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
        </div>
    );
};

export default ProjectTimelineTab;
