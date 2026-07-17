import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const pairKey = (workType, labourerId) => `${workType}::${labourerId}`;

/* Manages financeLabourRate rows for one project — mirrors
   ContractorRatesManager's grid exactly. Every (work type, labourer) pair
   is already fully determined by who's currently on a Work's labour team
   (financeWorkLabourAssignment) — there is nothing to freely "select", so
   this renders one row per real pair, grouped by work type: a saved rate
   shows read-only + Remove, an unset one shows an inline rate input.
   Always per-sqft — labour has no per-day payment basis. Supervisor is
   shown alongside each labourer since it's a fact about their current
   assignment, not something this panel sets. */
const WorkersManager = ({ url, projectId, worksVersion }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Who's actually assigned to a Work of a given type on this project
    // right now (from financeWorkLabourAssignment) — not the entire
    // labourer master. Map<workType, Array<{labourerId, labourerName,
    // supervisorName}>>.
    const [labourersByWorkType, setLabourersByWorkType] = useState(new Map());

    // Pending rate per unset (workType, labourerId) pair, keyed by pairKey,
    // and which key is currently being saved.
    const [pending, setPending] = useState({});
    const [savingKey, setSavingKey] = useState(null);

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/labour-rates/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error('Error fetching worker rates'); }
    };

    const fetchAssignments = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { projectId } });
            if (!res.data.success) return;
            const byType = new Map();
            const seen = new Set(); // dedupe — a labourer can only be on one Work at a time, but guard anyway
            for (const a of res.data.data) {
                const workType = a.workId?.workType;
                if (!workType || !a.labourerId) continue;
                const dedupeKey = `${workType}::${a.labourerId._id}`;
                if (seen.has(dedupeKey)) continue;
                seen.add(dedupeKey);
                if (!byType.has(workType)) byType.set(workType, []);
                byType.get(workType).push({
                    labourerId: a.labourerId._id, labourerName: a.labourerId.name,
                    supervisorName: a.supervisorId?.name || '—',
                });
            }
            setLabourersByWorkType(byType);
        } catch { /* leave as-is */ }
    };

    useEffect(() => {
        if (!projectId) return;
        setLoading(true);
        fetchList();
        fetchAssignments().finally(() => setLoading(false));
    }, [projectId, worksVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    const setPendingField = (key, value) => setPending(prev => ({ ...prev, [key]: value }));

    const saveGridRate = async (workType, labourerId, key) => {
        const rate = pending[key] ?? '';
        if (rate === '') { toast.error('Rate is required'); return; }
        setSavingKey(key);
        try {
            const res = await axios.post(`${url}/api/finance/labour-rates/add`, { projectId, labourerId, workType, ratePerSqft: rate }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Rate saved');
                setPending(prev => { const next = { ...prev }; delete next[key]; return next; });
                await fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving rate');
        } finally { setSavingKey(null); }
    };

    const removeRate = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/labour-rates/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing worker rate'); }
    };

    const findExisting = (workType, labourerId) => items.find(i =>
        i.workType === workType && (i.labourerId?._id || i.labourerId) === labourerId);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                One row per labourer actually assigned to each work type — fill in a rate to confirm it.
            </p>
            {labourersByWorkType.size === 0 ? (
                <div className="admin-empty-state"><p>No labour team assigned to any Work yet — add one from a Work's "Labour" action under the Works tab.</p></div>
            ) : (
                <div className="list-table">
                    {[...labourersByWorkType.entries()].map(([workType, labourers]) => (
                        <div key={workType}>
                            <div className="rate-group-header"><span className="rate-group-bar" /><b>{workType}</b></div>
                            {labourers.map(l => {
                                const existing = findExisting(workType, l.labourerId);
                                const key = pairKey(workType, l.labourerId);
                                const rate = pending[key] ?? '';
                                return (
                                    <div key={key} className="list-table-format row-item rate-row" style={{ gridTemplateColumns: '1.2fr 1.2fr 1.1fr 130px' }}>
                                        <p>{l.labourerName}</p>
                                        <p className="admin-subtitle">{l.supervisorName}</p>
                                        {existing ? (
                                            <span className="rate-entry-saved">₹{existing.ratePerSqft} / sqft</span>
                                        ) : (
                                            <input
                                                type="number" className="rate-entry-input" placeholder="Rate ₹/sqft" value={rate}
                                                onChange={e => setPendingField(key, e.target.value)}
                                            />
                                        )}
                                        <div className="rate-entry-action">
                                            {existing ? (
                                                <p onClick={() => removeRate(existing._id)} className="cursor delete-action" style={{ margin: 0 }}>Remove</p>
                                            ) : (
                                                <button
                                                    type="button" className="add-point-btn" disabled={savingKey === key}
                                                    onClick={() => saveGridRate(workType, l.labourerId, key)}
                                                >
                                                    {savingKey === key ? 'Saving…' : 'Save'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WorkersManager;
