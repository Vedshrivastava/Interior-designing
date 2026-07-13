import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const MaterialAnalysisView = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState('');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setLoading(true);
        axios.get(`${url}/api/finance/reports/material-analysis`, { ...authHeader, params: projectId ? { projectId } : {} })
            .then(res => { if (res.data.success) setRows(res.data.data); })
            .catch(() => toast.error('Error fetching material analysis'))
            .finally(() => setLoading(false));
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project</p>
                <select value={projectId} onChange={e => setProjectId(e.target.value)}>
                    <option value="">All projects</option>
                    {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
            </div>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr 1fr 1.2fr' }}>
                    <b>Material</b><b>Purchased</b><b>Returned</b><b>Consumed</b><b>Wasted</b><b>Current Stock</b><b>Avg Cost <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-lt)' }}>(weighted)</span></b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : rows.length === 0 ? (
                    <div className="admin-empty-state"><p>No material activity yet.</p></div>
                ) : rows.map(r => (
                    <div key={r.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr 1fr 1.2fr' }}>
                        <p>{r.materialName}</p>
                        <p>{r.totalPurchased.toLocaleString('en-IN')} {r.unit}</p>
                        <p>{r.totalReturned.toLocaleString('en-IN')} {r.unit}</p>
                        <p>{r.totalConsumed.toLocaleString('en-IN')} {r.unit}</p>
                        <p>{r.totalWasted.toLocaleString('en-IN')} {r.unit}</p>
                        <p>{r.currentStock.toLocaleString('en-IN')} {r.unit}</p>
                        <p>₹{r.weightedAverageCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MaterialAnalysisView;
