import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useWebSocket } from '../../hooks/useWebSocket';
import '../../styles/list.css';

const dateKey = (d) => new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
const timeLabel = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/*
 * Chronological activity log scoped to one project — mirrors
 * ActivityTimelinePage.jsx's day-grouped list-table rendering byte-for-byte
 * for visual parity (deliberately a separate component, not an extraction:
 * that page is already shipped/in active use and its fetch/filter/
 * websocket logic isn't cleanly separated from render, so extracting risks
 * regressing a working page for a small amount of shared logic). No
 * filter UI here — the project itself is already the fixed scope.
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
        </div>
    );
};

export default ProjectTimelineTab;
