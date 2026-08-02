import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import StyledSelect from './StyledSelect';
import { KpiCard, KpiGrid } from './DashboardWidgets';
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
                <StyledSelect value={clientId} onChange={onSelectClient} placeholder="Select client…" options={clients.map(c => ({ value: c._id, label: c.name }))} />
            </div>

            {loading && <div className="admin-empty-state"><p>Loading…</p></div>}
            {!loading && !clientId && <div className="admin-empty-state"><p>Select a client to view their profit rollup.</p></div>}

            {!loading && data && (
                <>
                    <KpiGrid>
                        <KpiCard label="Revenue" value={`₹${data.totals.revenue.toLocaleString('en-IN')}`} />
                        <KpiCard label="Total Costs" value={`₹${(data.totals.materialCost + data.totals.materialWasteCost + data.totals.contractorCost + data.totals.commissionCost + data.totals.otherExpenses + data.totals.labourCost).toLocaleString('en-IN')}`} />
                        <KpiCard label="Profit" value={`₹${data.totals.profit.toLocaleString('en-IN')} (${data.totals.marginPercent.toFixed(1)}%)`} tone={data.totals.profit >= 0 ? 'good' : 'danger'} />
                    </KpiGrid>
                    {(data.totals.totalContractorCost > data.totals.contractorCost || data.totals.totalLabourCost > data.totals.labourCost) && (
                        <p className="admin-subtitle" style={{ margin: '10px 0', color: '#c0392b' }}>
                            Contractor/labour costs above only count work already billed to the client: ₹{(data.totals.totalContractorCost - data.totals.contractorCost + data.totals.totalLabourCost - data.totals.labourCost).toLocaleString('en-IN')} more is logged but still Unapproved (not yet billed), so Profit will move once it's billed.
                        </p>
                    )}

                    {(data.totals.directPaymentContractorTotal + data.totals.directPaymentLabourTotal) > 0 && (
                        <>
                            <p className="admin-subtitle" style={{ margin: '24px 0 10px' }}>Direct Payments (Client → Workers), Across Every Project</p>
                            <div className="dash-chart-card rcp-dp-card" style={{ marginBottom: '8px' }}>
                                <div className="rcp-dp-row rcp-dp-header">
                                    <b className="rcp-dp-party">Party</b>
                                    <b className="rcp-dp-total">Total</b>
                                </div>
                                {data.totals.directPaymentContractorTotal > 0 && (
                                    <div className="rcp-dp-row">
                                        <p className="rcp-dp-party">Contractor</p>
                                        <p className="rcp-dp-total">₹{data.totals.directPaymentContractorTotal.toLocaleString('en-IN')}</p>
                                    </div>
                                )}
                                {data.totals.directPaymentLabourTotal > 0 && (
                                    <div className="rcp-dp-row">
                                        <p className="rcp-dp-party">Labour</p>
                                        <p className="rcp-dp-total">₹{data.totals.directPaymentLabourTotal.toLocaleString('en-IN')}</p>
                                    </div>
                                )}
                            </div>
                            <p className="admin-subtitle" style={{ marginBottom: '24px' }}>
                                Money this client paid directly to a contractor/labourer instead of through the company (an advance, not tied to specific sqft), summed across every one of their projects — a flat reduction against each worker's overall Balance Payable.
                            </p>
                        </>
                    )}

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By project</p>
                    <div className="dash-chart-card rcp-proj-card">
                        <div className="rcp-proj-row rcp-proj-header">
                            <b className="rcp-proj-name">Project</b>
                            <b className="rcp-proj-revenue">Revenue</b>
                            <b className="rcp-proj-profit">Profit</b>
                            <b className="rcp-proj-margin">Margin</b>
                            <b className="rcp-proj-action">Action</b>
                        </div>
                        {data.projects.length === 0 ? (
                            <div className="admin-empty-state"><p>No projects for this client yet.</p></div>
                        ) : data.projects.map(p => (
                            <div key={p.projectId} className="rcp-proj-row">
                                <p className="rcp-proj-name">{p.projectName}</p>
                                <p className="rcp-proj-revenue"><span className="pq-group-label">Revenue</span>₹{p.revenue.toLocaleString('en-IN')}</p>
                                <p className="rcp-proj-profit" style={{ color: p.profit >= 0 ? 'var(--moss)' : '#c0392b' }}><span className="pq-group-label">Profit</span>₹{p.profit.toLocaleString('en-IN')}</p>
                                <p className="rcp-proj-margin"><span className="pq-group-label">Margin</span>{p.marginPercent.toFixed(1)}%</p>
                                <div className="rcp-proj-action">
                                    <p className="cursor edit-action" onClick={() => onViewProjectProfit(p.projectId)}>View</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ClientProfitView;
