import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';

/* Read-only view of `consume` stock movements — these only ever come from
   the measurement-save automation, never entered directly, so there's no
   add form here (see StockMovementsManager for the manual dump/return/waste
   entry form). */
const MaterialConsumptionList = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchMovements = useCallback(() => {
        if (!selectedProjectId) { setMovements([]); return; }
        setLoading(true);
        axios.get(`${url}/api/finance/stock-movements/list`, { ...authHeader, params: { projectId: selectedProjectId, movementType: 'consume' } })
            .then(res => { if (res.data.success) setMovements(res.data.data); })
            .catch(() => toast.error('Error fetching consumption'))
            .finally(() => setLoading(false));
    }, [url, selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchMovements(); }, [fetchMovements]);
    // A measurement logged elsewhere auto-generates the consume movements
    // this list exists to show — without this, the list only reflects that
    // automation after the project dropdown itself is re-toggled.
    useFinanceWsRefresh(['financeStockChanged'], fetchMovements);

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project</p>
                <StyledSelect
                    value={selectedProjectId} onChange={setSelectedProjectId} placeholder="Select project…"
                    options={projects.map(p => ({ value: p._id, label: p.name }))}
                />
            </div>

            {!selectedProjectId ? (
                <div className="admin-empty-state"><p>Select a project to view its material consumption.</p></div>
            ) : (
                <div className="list-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.3fr 1fr' }}>
                        <b>Date</b><b>Material</b><b>Quantity</b>
                    </div>
                    {loading ? (
                        <div className="admin-empty-state"><p>Loading…</p></div>
                    ) : movements.length === 0 ? (
                        <div className="admin-empty-state"><p>No material consumed yet; this fills in as measurements are logged.</p></div>
                    ) : (
                        movements.map(m => (
                            <div key={m._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.3fr 1fr' }}>
                                <p>{new Date(m.date).toLocaleDateString()}</p>
                                <p>{m.materialId?.name || '-'}</p>
                                <p>{m.quantity} {m.materialId?.unit || ''}</p>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default MaterialConsumptionList;
