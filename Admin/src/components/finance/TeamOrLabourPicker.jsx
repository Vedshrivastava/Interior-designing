import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AddTeamOrLabourModal from './AddTeamOrLabourModal';

/*
 * Drop-in replacement for <QuickAddPicker resourceKey="teams" /> wherever
 * a Work's team assignment or a Team Rate row picks a team. The dropdown
 * itself stays contractor-only on purpose (only a contractor financeTeam
 * can be rated/assigned that way) — what changes is "+ Add New", which
 * now asks Contractor or Labour first instead of assuming Contractor.
 * Picking Labour routes into AddTeamOrLabourModal's own supervisor/roster
 * flow and never selects anything back here, since daily-wage labour was
 * never something this field could hold.
 */
const TeamOrLabourPicker = ({ url, value, onChange, placeholder }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [teams, setTeams] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchTeams = () => {
        axios.get(`${url}/api/finance/teams/list`, authHeader)
            .then(res => { if (res.data.success) setTeams(res.data.data); })
            .catch(() => {});
    };

    useEffect(() => { fetchTeams(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1 }}>
                    <option value="">{placeholder || 'Select contractor team…'}</option>
                    {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                <button type="button" className="add-point-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setModalOpen(true)}>+ Add New</button>
            </div>

            {modalOpen && (
                <AddTeamOrLabourModal
                    url={url}
                    onClose={() => setModalOpen(false)}
                    onTeamCreated={(id) => { fetchTeams(); onChange(id); setModalOpen(false); }}
                />
            )}
        </>
    );
};

export default TeamOrLabourPicker;
