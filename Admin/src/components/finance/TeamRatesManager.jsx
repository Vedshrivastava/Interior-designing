import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

/* Manages financeTeamRate rows for one project — used in both the New
   Project wizard (Step 4) and the Project Detail page's Team Rates tab.
   A single team can have multiple rows on the same project, one per work type. */
const TeamRatesManager = ({ url, projectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [items, setItems] = useState([]);
    const [teams, setTeams] = useState([]);
    const [teamId, setTeamId] = useState('');
    const [workType, setWorkType] = useState('');
    const [paymentBasis, setPaymentBasis] = useState('per_sqft');
    const [rate, setRate] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/team-rates/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error('Error fetching team rates'); }
    };

    useEffect(() => { if (projectId) fetchList(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        axios.get(`${url}/api/finance/teams/list`, authHeader)
            .then(res => { if (res.data.success) setTeams(res.data.data); })
            .catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const addRate = async (e) => {
        e.preventDefault();
        if (!teamId) { toast.error('Team is required'); return; }
        if (!workType.trim()) { toast.error('Work type is required'); return; }
        if (rate === '') { toast.error('Rate is required'); return; }
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/team-rates/add`, {
                projectId, teamId, workType: workType.trim(), paymentBasis,
                ratePerSqft: paymentBasis === 'per_sqft' ? rate : 0,
                ratePerDay: paymentBasis === 'per_day' ? rate : 0,
            }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                setWorkType(''); setRate('');
                await fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding team rate');
        } finally { setSaving(false); }
    };

    const removeRate = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/team-rates/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing team rate'); }
    };

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                Assign teams and add one rate row per work type each team performs. Required before this project can go active.
            </p>

            <form onSubmit={addRate} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <select value={teamId} onChange={e => setTeamId(e.target.value)} style={{ flex: 1, minWidth: '160px' }}>
                    <option value="">Select team…</option>
                    {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                <input type="text" placeholder="Work type (e.g. Putty)" value={workType} onChange={e => setWorkType(e.target.value)} style={{ flex: 1, minWidth: '140px' }} />
                <select value={paymentBasis} onChange={e => setPaymentBasis(e.target.value)} style={{ flex: 1, minWidth: '120px' }}>
                    <option value="per_sqft">Per Sqft</option>
                    <option value="per_day">Per Day</option>
                </select>
                <input type="number" placeholder={paymentBasis === 'per_sqft' ? 'Rate ₹/sqft' : 'Rate ₹/day'} value={rate} onChange={e => setRate(e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
                <button type="submit" className="add-point-btn" disabled={saving}>{saving ? 'Adding…' : '+ Add Rate'}</button>
            </form>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 1fr 100px' }}>
                    <b>Team</b><b>Work Type</b><b>Basis</b><b>Rate</b><b>Action</b>
                </div>
                {items.length === 0 ? (
                    <div className="admin-empty-state"><p>No team rates yet.</p></div>
                ) : (
                    items.map(item => (
                        <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 1fr 100px' }}>
                            <p>{item.teamId?.name || '—'}</p>
                            <p>{item.workType}</p>
                            <p>{item.paymentBasis === 'per_sqft' ? 'Per Sqft' : 'Per Day'}</p>
                            <p>₹{item.paymentBasis === 'per_sqft' ? item.ratePerSqft : item.ratePerDay}</p>
                            <div className="action-buttons">
                                <p onClick={() => removeRate(item._id)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TeamRatesManager;
