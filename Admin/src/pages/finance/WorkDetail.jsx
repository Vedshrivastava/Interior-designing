import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { KpiCard, KpiGrid, ChartCard, ChartGrid, EmptyChart, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
import StyledDatePicker from '../../components/finance/StyledDatePicker';
import StyledMonthPicker from '../../components/finance/StyledMonthPicker';
import ToggleSwitch from '../../components/finance/ToggleSwitch';
import '../../styles/list.css';
import '../../styles/dashboard.css';

const thisMonth = () => new Date().toISOString().slice(0, 7);

/*
 * Tier-2 drill-down for one work — reached identically from the Works
 * tab's "Details" action and from a measurement row's "Details" action
 * (project Measurements tab / Site Operations), same route either way.
 * Everything here comes from GET /reports/work-detail. Month drives the
 * all-time-context daily material-cost chart; Date (optional, pre-filled
 * via ?date= when arriving from a measurement row) adds a same-page
 * "on this day" report — area covered and contractor/labour cost for
 * exactly that date — alongside the existing all-time totals, not
 * instead of them.
 */
const WorkDetail = ({ url }) => {
    const { id: projectId, workId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [month, setMonth] = useState(thisMonth());
    const [date, setDate] = useState(searchParams.get('date') || '');
    const [upto, setUpto] = useState(false);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const setDateFilter = (v) => { setDate(v); setSearchParams(v ? { date: v } : {}); if (!v) setUpto(false); };

    useEffect(() => {
        setLoading(true);
        const params = { workId, month };
        if (date) { params.date = date; if (upto) params.upto = 'true'; }
        axios.get(`${url}/api/finance/reports/work-detail`, { ...authHeader, params })
            .then(res => { if (res.data.success) setData(res.data.data); else toast.error(res.data.message); })
            .catch(() => toast.error('Error fetching work detail'))
            .finally(() => setLoading(false));
    }, [url, workId, month, date, upto]); // eslint-disable-line react-hooks/exhaustive-deps

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
                        <p className="admin-subtitle" style={{ margin: '0 0 2px' }}>{data.projectName}</p>
                        <h1>{data.workType}</h1>
                        <p className="admin-subtitle">{data.completedAreaSqft} / {data.estimatedAreaSqft} sqft completed</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div className="add-product-name flex-col" style={{ maxWidth: '160px' }}>
                            <p>Date</p>
                            <StyledDatePicker value={date} onChange={setDateFilter} />
                        </div>
                        <div className="add-product-name flex-col" style={{ maxWidth: '180px' }}>
                            <p>Month</p>
                            <StyledMonthPicker value={month} onChange={setMonth} align="right" />
                        </div>
                    </div>
                </div>

                {date && (
                    <div className="list-table" style={{ marginBottom: '24px' }}>
                        <div className="rate-group-header" style={{ justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span className="rate-group-bar" />
                                <b>{upto ? `Up to ${new Date(date).toLocaleDateString()}` : `On ${new Date(date).toLocaleDateString()}`}</b>
                            </div>
                            <ToggleSwitch checked={upto} onChange={setUpto} label="Include everything up to this date" />
                        </div>
                        {!data.dayReport || data.dayReport.areaCoveredSqft === 0 ? (
                            <div className="admin-empty-state"><p>No measurements logged for this Work {upto ? 'up to' : 'on'} this date.</p></div>
                        ) : (
                            <div style={{ padding: '20px' }}>
                                <KpiGrid>
                                    <KpiCard label="Area Covered" value={`${data.dayReport.areaCoveredSqft} sqft`} />
                                    <KpiCard label="Contractor Cost" value={formatINR(data.dayReport.contractorCost)} />
                                    <KpiCard label="Labour Cost" value={formatINR(data.dayReport.labourCost)} />
                                    <KpiCard label="Total Cost" value={formatINR(data.dayReport.totalCost)} />
                                </KpiGrid>

                                {data.dayReport.contractorBreakdown.length > 0 && (
                                    <div className="list-table" style={{ marginTop: '20px' }}>
                                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr' }}>
                                            <b>Contractor</b><b>Area (sqft)</b><b>Rate</b><b>Earnings</b>
                                        </div>
                                        {data.dayReport.contractorBreakdown.map(b => (
                                            <div key={b.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr' }}>
                                                <p>{b.vendorName}</p>
                                                <p>{b.areaSqft}</p>
                                                <p>{formatINR(b.rate)}</p>
                                                <p>{formatINR(b.earnings)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {data.dayReport.labourBreakdown.length > 0 && (
                                    <div className="list-table" style={{ marginTop: '20px' }}>
                                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr' }}>
                                            <b>Labourer</b><b>Area (sqft)</b><b>Rate</b><b>Earnings</b>
                                        </div>
                                        {data.dayReport.labourBreakdown.map(b => (
                                            <div key={b.labourerId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr' }}>
                                                <p>{b.labourerName}</p>
                                                <p>{b.areaSqft}</p>
                                                <p>{formatINR(b.rate)}</p>
                                                <p>{formatINR(b.earnings)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <h3 style={{ margin: '0 0 4px' }}>All-Time Totals</h3>
                <p className="admin-subtitle" style={{ margin: '0 0 16px' }}>Not affected by the Date or Month filters above — every measurement ever logged against this Work.</p>

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
                    <KpiCard label="Contractor Cost" value={formatINR(data.contractorCost)} />
                    <KpiCard label="Labour Cost" value={formatINR(data.labourCost)} />
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

                {data.labourBreakdown && data.labourBreakdown.length > 0 && (
                    <div className="list-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr' }}>
                            <b>Labourer</b><b>Area (sqft)</b><b>Rate</b><b>Earnings</b>
                        </div>
                        {data.labourBreakdown.map(b => (
                            <div key={b.labourerId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr' }}>
                                <p>{b.labourerName}</p>
                                <p>{b.areaSqft}</p>
                                <p>{formatINR(b.rate)}</p>
                                <p>{formatINR(b.earnings)}</p>
                            </div>
                        ))}
                    </div>
                )}

                <h3 style={{ margin: '28px 0 4px' }}>This Month — {new Date(`${month}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
                <p className="admin-subtitle" style={{ margin: '0 0 16px' }}>Scoped to the Month filter above — change it to look at a different month.</p>
                <KpiGrid>
                    <KpiCard
                        label="Average Cost/Sqft"
                        value={formatINR(data.averageCostPerSqft)}
                        sub="Mean of each day's cost/sqft ratio — not total cost ÷ total area"
                    />
                </KpiGrid>

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
