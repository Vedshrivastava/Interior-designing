import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { KpiCard, KpiGrid, ChartCard, ChartGrid, EmptyChart, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
import '../../styles/list.css';
import '../../styles/dashboard.css';

const thisMonth = () => new Date().toISOString().slice(0, 7);

/*
 * Tier-2 drill-down for one work — new route, didn't exist before this
 * build (Work Profit used to only be reachable via the Reports page's
 * picker). Everything here comes from GET /reports/work-detail.
 */
const WorkDetail = ({ url }) => {
    const { id: projectId, workId } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [month, setMonth] = useState(thisMonth());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`${url}/api/finance/reports/work-detail`, { ...authHeader, params: { workId, month } })
            .then(res => { if (res.data.success) setData(res.data.data); else toast.error(res.data.message); })
            .catch(() => toast.error('Error fetching work detail'))
            .finally(() => setLoading(false));
    }, [url, workId, month]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return <div className="list add flex-col"><div className="admin-list-container"><div className="admin-empty-state"><p>Loading…</p></div></div></div>;
    }
    if (!data) {
        return <div className="list add flex-col"><div className="admin-list-container"><div className="admin-empty-state"><p>Work not found.</p></div></div></div>;
    }

    const ringDeg = Math.min(360, (data.progressPercent / 100) * 360);

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <button type="button" className="admin-search-clear" style={{ position: 'static', fontSize: '0.8rem', color: 'var(--text-lt)', marginBottom: '8px' }} onClick={() => navigate(`/finance/projects/${projectId}`)}>← Back to Project</button>
                        <h1>{data.workType}</h1>
                        <p className="admin-subtitle">{data.completedAreaSqft} / {data.estimatedAreaSqft} sqft completed</p>
                    </div>
                    <div className="add-product-name flex-col" style={{ maxWidth: '180px' }}>
                        <p>Month</p>
                        <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                    <div style={{
                        width: 90, height: 90, borderRadius: '50%',
                        background: `conic-gradient(var(--moss, #2d4a35) ${ringDeg}deg, rgba(201,168,124,0.18) ${ringDeg}deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                            {data.progressPercent}%
                        </div>
                    </div>
                    <p className="admin-subtitle" style={{ margin: 0 }}>Progress toward estimated area</p>
                </div>

                <KpiGrid>
                    <KpiCard
                        label="Average Cost/Sqft (this month)"
                        value={formatINR(data.averageCostPerSqft)}
                        sub="Mean of each day's cost/sqft ratio — not total cost ÷ total area"
                    />
                    <KpiCard label="Contractor Cost" value={formatINR(data.contractorCost)} />
                    <KpiCard label="Revenue" value={formatINR(data.revenue)} />
                    <KpiCard label="Profit" value={formatINR(data.profit)} tone={data.profit >= 0 ? 'good' : 'danger'} />
                </KpiGrid>

                {data.contractorBreakdown && data.contractorBreakdown.length > 1 && (
                    <div className="list-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr' }}>
                            <b>Contractor</b><b>Area (sqft)</b><b>Rate</b><b>Earnings</b>
                        </div>
                        {data.contractorBreakdown.map(b => (
                            <div key={b.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr' }}>
                                <p>{b.vendorName}</p>
                                <p>{b.areaSqft}</p>
                                <p>{formatINR(b.rate)}</p>
                                <p>{formatINR(b.earnings)}</p>
                            </div>
                        ))}
                    </div>
                )}

                <ChartGrid>
                    <ChartCard title={`Daily Cost/Sqft — ${month}`}>
                        {data.dailyBreakdown.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={data.dailyBreakdown}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip formatter={(v) => formatINR(v)} />
                                    <Line type="monotone" dataKey="costPerSqft" name="Cost/Sqft" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart text="No measurements this month." />}
                    </ChartCard>
                </ChartGrid>

                <div className="list-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: "1fr" }}><b>Material Used</b></div>
                    {data.materialUsed.length === 0 ? (
                        <div className="admin-empty-state"><p>No material used yet.</p></div>
                    ) : data.materialUsed.map(m => (
                        <div key={m.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <p>{m.materialName}</p>
                            <p>{m.quantity} {m.unit}</p>
                        </div>
                    ))}
                </div>

                <div className="list-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: "1fr" }}><b>Material Wasted (attributed to this work)</b></div>
                    {data.materialWasted.length === 0 ? (
                        <div className="admin-empty-state"><p>No waste attributed to this work yet.</p></div>
                    ) : data.materialWasted.map(m => (
                        <div key={m.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <p>{m.materialName}</p>
                            <p>{m.quantity} {m.unit}</p>
                        </div>
                    ))}
                </div>

                {data.projectLevelWaste.length > 0 && (
                    <div className="list-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: "1fr" }}><b>Project-Level Waste (not attributed to any specific work)</b></div>
                        <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                            Recorded before per-work waste tracking existed, or entered without picking a work — shown here separately rather than silently folded into or excluded from this work&apos;s numbers.
                        </p>
                        {data.projectLevelWaste.map(m => (
                            <div key={m.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <p>{m.materialName}</p>
                                <p>{m.quantity} {m.unit}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkDetail;
