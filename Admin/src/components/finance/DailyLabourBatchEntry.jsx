import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import '../../styles/list.css';

const ATTENDANCE_OPTIONS = [
    { value: '', label: '—' },
    { value: 'half_day', label: 'Half' },
    { value: 'full_day', label: 'Full' },
    { value: 'extra_day', label: 'Extra' },
];

const toDateKey = (d) => d.toISOString().slice(0, 10);
const shortLabel = (dateKey) => new Date(dateKey).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });

/*
 * Several labourers x several days, submitted in one call to
 * /api/finance/daily-labour/batch-add — the alternative to DailyLabourManager's
 * one-entry-at-a-time form, for a supervisor logging a whole week of
 * attendance for their roster at once.
 */
const DailyLabourBatchEntry = ({ url, projectId, onSubmitted }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [supervisorId, setSupervisorId] = useState('');
    const [roster, setRoster] = useState([]);
    const [rosterLoading, setRosterLoading] = useState(false);

    const [startDate, setStartDate] = useState(toDateKey(new Date()));
    const [days, setDays] = useState(7);

    // grid[labourerId] = { rate, cells: { [dateKey]: attendanceType } }
    const [grid, setGrid] = useState({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!supervisorId) { setRoster([]); return; }
        setRosterLoading(true);
        axios.get(`${url}/api/finance/labourers/list`, { ...authHeader, params: { supervisorId } })
            .then(res => {
                if (!res.data.success) return;
                setRoster(res.data.data);
                setGrid(prev => {
                    const next = { ...prev };
                    res.data.data.forEach(l => {
                        if (!next[l._id]) next[l._id] = { rate: l.defaultRate || '', cells: {} };
                    });
                    return next;
                });
            })
            .catch(() => toast.error('Error fetching roster'))
            .finally(() => setRosterLoading(false));
    }, [url, supervisorId]); // eslint-disable-line react-hooks/exhaustive-deps

    const dateKeys = Array.from({ length: Math.max(1, Number(days) || 1) }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return toDateKey(d);
    });

    const setRate = (labourerId, rate) =>
        setGrid(prev => ({ ...prev, [labourerId]: { ...(prev[labourerId] || { cells: {} }), rate } }));
    const setCell = (labourerId, dateKey, attendanceType) =>
        setGrid(prev => ({
            ...prev,
            [labourerId]: {
                ...(prev[labourerId] || { rate: '', cells: {} }),
                cells: { ...(prev[labourerId]?.cells || {}), [dateKey]: attendanceType },
            },
        }));

    const submit = async () => {
        if (!projectId) return toast.error('Project is required');
        if (!supervisorId) return toast.error('Select a supervisor');

        const entries = [];
        for (const l of roster) {
            const row = grid[l._id];
            if (!row) continue;
            for (const dateKey of dateKeys) {
                const attendanceType = row.cells[dateKey];
                if (!attendanceType) continue;
                entries.push({
                    projectId, date: dateKey, labourerId: l._id,
                    attendanceType, rate: row.rate, supervisorId,
                });
            }
        }
        if (!entries.length) return toast.error('Mark attendance for at least one labourer/day');
        if (entries.some(e => !e.rate || Number(e.rate) <= 0)) return toast.error('Every labourer with marked attendance needs a rate');

        setSubmitting(true);
        try {
            const res = await axios.post(`${url}/api/finance/daily-labour/batch-add`, { entries }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                setGrid(prev => {
                    const next = {};
                    Object.entries(prev).forEach(([id, row]) => { next[id] = { rate: row.rate, cells: {} }; });
                    return next;
                });
                if (onSubmitted) onSubmitted();
            } else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording batch entry'); }
        finally { setSubmitting(false); }
    };

    return (
        <div>
            <div className="wizard-field-grid" style={{ marginBottom: '16px' }}>
                <div className="add-product-name flex-col">
                    <p>Supervisor *</p>
                    <QuickAddPicker url={url} resourceKey="employees" value={supervisorId} onChange={setSupervisorId} placeholder="Select supervisor…" />
                </div>
                <div className="add-product-name flex-col">
                    <p>Start Date</p>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="add-product-name flex-col">
                    <p>Number of Days</p>
                    <input type="number" min="1" max="31" value={days} onChange={e => setDays(e.target.value)} />
                </div>
            </div>

            {!supervisorId ? (
                <div className="admin-empty-state"><p>Select a supervisor to load their roster.</p></div>
            ) : rosterLoading ? (
                <div className="admin-empty-state"><p>Loading roster…</p></div>
            ) : roster.length === 0 ? (
                <div className="admin-empty-state"><p>This supervisor has no labourers on their roster yet — add some under Supervisors &gt; Roster.</p></div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table className="list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '8px', minWidth: '140px' }}>Labourer</th>
                                <th style={{ textAlign: 'left', padding: '8px', minWidth: '90px' }}>Rate (₹/day)</th>
                                {dateKeys.map(dk => (
                                    <th key={dk} style={{ textAlign: 'center', padding: '8px', minWidth: '80px' }}>{shortLabel(dk)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {roster.map(l => (
                                <tr key={l._id}>
                                    <td style={{ padding: '8px' }}>{l.name}</td>
                                    <td style={{ padding: '8px' }}>
                                        <input type="number" value={grid[l._id]?.rate ?? ''} onChange={e => setRate(l._id, e.target.value)} style={{ width: '90px' }} />
                                    </td>
                                    {dateKeys.map(dk => (
                                        <td key={dk} style={{ textAlign: 'center', padding: '4px' }}>
                                            <select value={grid[l._id]?.cells[dk] || ''} onChange={e => setCell(l._id, dk, e.target.value)}>
                                                {ATTENDANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="wizard-actions" style={{ marginTop: '16px' }}>
                        <span />
                        <button type="button" className="add-btn" disabled={submitting} onClick={submit}>
                            {submitting ? 'Saving…' : '+ Submit Batch'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyLabourBatchEntry;
