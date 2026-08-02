import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import StyledSelect from './StyledSelect';
import '../../styles/list.css';

// Same dashboardCache idea as FinanceHome.jsx, keyed by projectId ('' means
// "all projects") since this table's data changes with the picker. Stock
// figures here can genuinely move day to day, but the background refetch
// on every mount keeps this at most one silent refresh stale — same
// tradeoff as every other cached view in this app.
const materialAnalysisCache = new Map();

const MaterialAnalysisView = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectId, setProjectId] = useState('');
    const [rows, setRows] = useState(materialAnalysisCache.get('') || []);
    const [loading, setLoading] = useState(!materialAnalysisCache.has(''));

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => {
            if (!res.data.success) return;
            setProjects(res.data.data);
            // Cost/Sqft only ever computes with a project picked (see below) —
            // defaulting to "All projects" meant it always opened on the one
            // state where that column can never show anything. Auto-pick the
            // first project instead, same as a real visit would look for.
            setProjectId(prev => prev || res.data.data[0]?._id || '');
        }).catch(() => {}).finally(() => setProjectsLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchRows = () => {
        axios.get(`${url}/api/finance/reports/material-analysis`, { ...authHeader, params: projectId ? { projectId } : {} })
            .then(res => { if (res.data.success) { setRows(res.data.data); materialAnalysisCache.set(projectId, res.data.data); } })
            .catch(() => toast.error('Error fetching material analysis'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const cached = materialAnalysisCache.get(projectId);
        if (cached) { setRows(cached); setLoading(false); }
        else setLoading(true);
        fetchRows();
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh(['financeMaterialsChanged', 'financePurchasesChanged', 'financeStockChanged'], fetchRows);

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project</p>
                <StyledSelect
                    value={projectId} onChange={setProjectId} placeholder="All projects" loading={projectsLoading}
                    options={projects.map(p => ({ value: p._id, label: p.name }))}
                />
            </div>

            {!projectId && (
                <p className="admin-subtitle" style={{ marginBottom: '12px' }}>
                    Cost/Sqft is only meaningful scoped to one project — pick a project above to see it; it shows as — for "All projects".
                </p>
            )}
            <div className="dash-chart-card rma-card">
                <div className="rma-row rma-header">
                    <b className="rma-material">Material</b>
                    <b className="rma-purchased">Purchased</b>
                    <b className="rma-returned">Returned</b>
                    <b className="rma-consumed">Consumed</b>
                    <b className="rma-wasted">Wasted</b>
                    <b className="rma-stock">Current Stock</b>
                    <b className="rma-avgcost">Avg Cost <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-lt)' }}>(weighted, /unit)</span></b>
                    <b className="rma-costsqft">Cost/Sqft</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : rows.length === 0 ? (
                    <div className="admin-empty-state"><p>No material activity yet.</p></div>
                ) : rows.map(r => (
                    <div key={r.materialId} className="rma-row">
                        <p className="rma-material">{r.materialName}</p>
                        <p className="rma-purchased"><span className="pq-group-label">Purchased</span>{r.totalPurchased.toLocaleString('en-IN')} {r.unit}</p>
                        <p className="rma-returned"><span className="pq-group-label">Returned</span>{r.totalReturned.toLocaleString('en-IN')} {r.unit}</p>
                        <p className="rma-consumed"><span className="pq-group-label">Consumed</span>{r.totalConsumed.toLocaleString('en-IN')} {r.unit}</p>
                        <p className="rma-wasted" style={{ color: r.wasteCost > 0 ? '#c0392b' : 'inherit' }}>
                            <span className="pq-group-label">Wasted</span>{r.totalWasted.toLocaleString('en-IN')} {r.unit}
                            {r.wasteCost > 0 && (
                                <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem' }}>₹{r.wasteCost.toLocaleString('en-IN')} loss</span>
                            )}
                        </p>
                        <p className="rma-stock"><span className="pq-group-label">Current Stock</span>{r.currentStock.toLocaleString('en-IN')} {r.unit}</p>
                        <p className="rma-avgcost"><span className="pq-group-label">Avg Cost</span>₹{r.weightedAverageCost.toFixed(2)}/{r.unit}</p>
                        <p className="rma-costsqft"><span className="pq-group-label">Cost/Sqft</span>{projectId && r.areaCoveredSqft > 0 ? `₹${r.costPerSqft.toFixed(2)}/sqft` : '—'}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MaterialAnalysisView;
