import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';

// Same dashboardCache idea as FinanceHome.jsx, keyed by clientId.
const clientProfitCache = new Map();

/* Client picker + a rollup across every project belonging to that client —
   each row links back into Project Profit for that one project. */
const ClientProfitView = ({ url, clientId, onSelectClient, onViewProjectProfit }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [clients, setClients] = useState([]);
    const [data, setData] = useState(clientProfitCache.get(clientId) || null);
    const [loading, setLoading] = useState(!!clientId && !clientProfitCache.has(clientId));

    useEffect(() => {
        axios.get(`${url}/api/finance/clients/list`, authHeader).then(res => { if (res.data.success) setClients(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchData = () => {
        axios.get(`${url}/api/finance/reports/client-profit`, { ...authHeader, params: { clientId } })
            .then(res => { if (res.data.success) { setData(res.data.data); clientProfitCache.set(clientId, res.data.data); } })
            .catch(() => toast.error('Error fetching client profit'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!clientId) { setData(null); return; }
        const existing = clientProfitCache.get(clientId);
        if (existing) { setData(existing); setLoading(false); }
        else setLoading(true);
        fetchData();
    }, [url, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Wraps computeProjectProfit across every project for this client, so
    // it inherits the same breadth — any finance broadcast triggers a
    // silent refetch while a client is selected.
    useFinanceWsRefresh(['*'], () => { if (clientId) fetchData(); });

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Client</p>
                <select value={clientId} onChange={e => onSelectClient(e.target.value)}>
                    <option value="">Select client…</option>
                    {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
            </div>

            {loading && <div className="admin-empty-state"><p>Loading…</p></div>}
            {!loading && !clientId && <div className="admin-empty-state"><p>Select a client to view their profit rollup.</p></div>}

            {!loading && data && (
                <>
                    <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <b>Revenue</b><b>Total Costs</b><b>Profit</b>
                        </div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <p>₹{data.totals.revenue.toLocaleString('en-IN')}</p>
                            <p>₹{(data.totals.materialCost + data.totals.contractorCost + data.totals.commissionCost + data.totals.otherExpenses + data.totals.labourCost).toLocaleString('en-IN')}</p>
                            <p style={{ fontWeight: 700, color: data.totals.profit >= 0 ? 'var(--moss)' : '#c0392b' }}>
                                ₹{data.totals.profit.toLocaleString('en-IN')} ({data.totals.marginPercent.toFixed(1)}%)
                            </p>
                        </div>
                    </div>
                    {(data.totals.totalContractorCost > data.totals.contractorCost || data.totals.totalLabourCost > data.totals.labourCost) && (
                        <p className="admin-subtitle" style={{ marginBottom: '10px', color: '#c0392b' }}>
                            Contractor/labour costs above only count work already billed to the client: ₹{(data.totals.totalContractorCost - data.totals.contractorCost + data.totals.totalLabourCost - data.totals.labourCost).toLocaleString('en-IN')} more is logged but still Unapproved (not yet billed), so Profit will move once it's billed.
                        </p>
                    )}

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By project</p>
                    <div className="list-table finance-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 140px' }}>
                            <b>Project</b><b>Revenue</b><b>Profit</b><b>Margin</b><b>Action</b>
                        </div>
                        {data.projects.length === 0 ? (
                            <div className="admin-empty-state"><p>No projects for this client yet.</p></div>
                        ) : data.projects.map(p => (
                            <div key={p.projectId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 140px' }}>
                                <p>{p.projectName}</p>
                                <p>₹{p.revenue.toLocaleString('en-IN')}</p>
                                <p style={{ color: p.profit >= 0 ? 'var(--moss)' : '#c0392b' }}>₹{p.profit.toLocaleString('en-IN')}</p>
                                <p>{p.marginPercent.toFixed(1)}%</p>
                                <p className="cursor edit-action" onClick={() => onViewProjectProfit(p.projectId)}>View</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ClientProfitView;
