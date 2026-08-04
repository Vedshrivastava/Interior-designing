import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/add.css';

/* Read-only view of `consume` stock movements — these only ever come from
   the measurement-save automation, never entered directly, so there's no
   add form here (see StockMovementsManager for the manual dump/return/waste
   entry form). */
const MaterialConsumptionList = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {}).finally(() => setProjectsLoading(false));
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

    // Total ever consumed per material at this project — every row here is
    // already a `consume` movement (the fetch itself is filtered to that
    // type), so this is a pure sum, not a stock balance like
    // StockMovementsManager's Current Stock (which also nets out
    // dump/return/waste). Computed client-side from what's already fetched
    // rather than a new endpoint — the raw list below is already the full
    // per-project consume history.
    const totalsByMaterial = useMemo(() => {
        const map = new Map();
        for (const m of movements) {
            const key = m.materialId?._id || m.materialId;
            if (!key) continue;
            const row = map.get(key) || { materialId: key, name: m.materialId?.name || '-', unit: m.materialId?.unit || '', total: 0 };
            row.total += m.quantity;
            map.set(key, row);
        }
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [movements]);

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project</p>
                <StyledSelect
                    value={selectedProjectId} onChange={setSelectedProjectId} placeholder="Select project…" loading={projectsLoading}
                    options={projects.map(p => ({ value: p._id, label: p.name }))}
                />
            </div>

            {!selectedProjectId ? (
                <div className="admin-empty-state"><p>Select a project to view its material consumption.</p></div>
            ) : (
                <>
                <h3 style={{ marginBottom: '4px' }}>Total Consumption</h3>
                <p className="admin-subtitle" style={{ margin: '0 0 12px' }}>SUM of every consume movement logged at this project, per material.</p>
                <div className="list-table finance-table" style={{ marginBottom: '32px' }}>
                    <div className="list-table-format title smm-stock-row smm-stock-header" style={{ gridTemplateColumns: '280px 1fr 1fr' }}>
                        <b>Material</b><b>Total Consumed</b><b>Unit</b>
                    </div>
                    {loading ? (
                        <div className="admin-empty-state"><p>Loading…</p></div>
                    ) : totalsByMaterial.length === 0 ? (
                        <div className="admin-empty-state"><p>No material consumed yet.</p></div>
                    ) : (
                        totalsByMaterial.map(row => (
                            <div key={row.materialId} className="list-table-format row-item smm-stock-row" style={{ gridTemplateColumns: '280px 1fr 1fr' }}>
                                <p className="smm-stock-material">{row.name}</p>
                                <div className="smm-stock-value-field">
                                    <span className="wt-field-label">Total Consumed</span>
                                    <p className="smm-stock-value">{row.total}</p>
                                </div>
                                <div className="smm-stock-unit-field">
                                    <span className="wt-field-label">Unit</span>
                                    <p className="smm-stock-unit">{row.unit || '-'}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <h3 style={{ marginBottom: '4px' }}>Consumption Log</h3>
                <p className="admin-subtitle" style={{ margin: '0 0 12px' }}>Every individual consume movement, newest first.</p>
                <div className="list-table finance-table">
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
                </>
            )}
        </div>
    );
};

export default MaterialConsumptionList;
