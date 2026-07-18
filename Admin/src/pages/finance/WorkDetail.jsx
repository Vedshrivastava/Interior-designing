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
const today = () => new Date().toISOString().slice(0, 10);

const SCOPES = [
    { key: 'day', label: 'Day' },
    { key: 'month', label: 'Month' },
    { key: 'alltime', label: 'All Time' },
];

/*
 * Tier-2 drill-down for one work — reached identically from the Works
 * tab's "Details" action and from a measurement row's "Details" action
 * (project Measurements tab / Site Operations), same route either way.
 * Everything here comes from GET /reports/work-detail, scoped to exactly
 * one of Day / Month / All Time at a time — showing all three
 * simultaneously (the previous design) got cluttered fast, and it wasn't
 * obvious which numbers were scoped by which filter. Only the picker
 * relevant to the chosen scope is shown; area, contractor/labour cost +
 * breakdown, material used/wasted, and the daily cost/sqft trend all
 * follow the same scope. Revenue/Profit stay All-Time only regardless of
 * scope — they come from issued running bills, which aren't
 * measurement-dated, so a "daily profit" isn't a coherent number.
 */
const WorkDetail = ({ url }) => {
    const { id: projectId, workId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const initialDate = searchParams.get('date') || '';
    const [scope, setScope] = useState(initialDate ? 'day' : 'alltime');
    const [date, setDate] = useState(initialDate || today());
    const [month, setMonth] = useState(thisMonth());
    const [upto, setUpto] = useState(false);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const changeScope = (s) => { setScope(s); setSearchParams({}); };
    const changeDate = (v) => { setDate(v); setSearchParams({}); };

    useEffect(() => {
        setLoading(true);
        const params = { workId, scope };
        if (scope === 'day') { params.date = date; if (upto) params.upto = 'true'; }
        if (scope === 'month') params.month = month;
        axios.get(`${url}/api/finance/reports/work-detail`, { ...authHeader, params })
            .then(res => { if (res.data.success) setData(res.data.data); else toast.error(res.data.message); })
            .catch(() => toast.error('Error fetching work detail'))
            .finally(() => setLoading(false));
    }, [url, workId, scope, date, month, upto]); // eslint-disable-line react-hooks/exhaustive-deps

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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                        <div className="measurement-type-toggle" style={{ margin: 0 }}>
                            {SCOPES.map(s => (
                                <button
                                    key={s.key} type="button"
                                    className={`labour-chip${scope === s.key ? ' active' : ''}`}
                                    onClick={() => changeScope(s.key)}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                        {scope === 'day' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ maxWidth: '160px' }}>
                                    <StyledDatePicker value={date} onChange={changeDate} align="right" />
                                </div>
                                <ToggleSwitch checked={upto} onChange={setUpto} label="Up to this date" />
                            </div>
                        )}
                        {scope === 'month' && (
                            <div style={{ maxWidth: '180px' }}>
                                <StyledMonthPicker value={month} onChange={setMonth} align="right" />
                            </div>
                        )}
                    </div>
                </div>

                <h3 style={{ margin: '0 0 4px' }}>{data.scopeLabel}</h3>
                <p className="admin-subtitle" style={{ margin: '0 0 16px' }}>
                    {scope === 'alltime'
                        ? 'Every measurement ever logged against this Work.'
                        : `Everything below (area, cost, material) is scoped to ${scope === 'day' ? 'this date' : 'this month'}.`}
                </p>

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
                    <p className="admin-subtitle" style={{ margin: 0 }}>Progress toward estimated area (always all-time)</p>
                </div>

                <KpiGrid>
                    <KpiCard label="Area Covered" value={`${data.areaCoveredSqft} sqft`} />
                    <KpiCard
                        label="Contractor Cost (Approved)"
                        value={data.contractorCost > 0 ? formatINR(data.contractorCost) : (data.totalContractorAmount > 0 ? 'Unapproved' : formatINR(0))}
                        tone={data.contractorCost > 0 ? 'good' : (data.totalContractorAmount > 0 ? 'danger' : undefined)}
                        sub={data.totalContractorAmount > data.contractorCost ? `Total logged: ${formatINR(data.totalContractorAmount)}` : 'All-time, not scoped by the picker above'}
                    />
                    <KpiCard
                        label="Labour Cost (Approved)"
                        value={data.labourCost > 0 ? formatINR(data.labourCost) : (data.totalLabourAmount > 0 ? 'Unapproved' : formatINR(0))}
                        tone={data.labourCost > 0 ? 'good' : (data.totalLabourAmount > 0 ? 'danger' : undefined)}
                        sub={data.totalLabourAmount > data.labourCost ? `Total logged: ${formatINR(data.totalLabourAmount)}` : 'All-time, not scoped by the picker above'}
                    />
                    {scope === 'alltime' ? (
                        <>
                            <KpiCard label="Revenue" value={formatINR(data.revenue)} />
                            <KpiCard label="Profit" value={formatINR(data.profit)} tone={data.profit >= 0 ? 'good' : 'danger'} />
                        </>
                    ) : (
                        <KpiCard label="Total Cost" value={formatINR(data.totalCost)} />
                    )}
                    <KpiCard
                        label="Average Material Cost/Sqft"
                        value={formatINR(data.averageCostPerSqft)}
                        sub="Mean of each day's cost/sqft ratio, not total cost ÷ total area"
                    />
                    <KpiCard
                        label="Expected Pay (Net of Deductions)"
                        value={formatINR(data.expectedPayNetOfDeductions)}
                        sub={data.deductedTotal > 0 ? `₹${data.expectedPay.toLocaleString('en-IN')} expected − ₹${data.deductedTotal.toLocaleString('en-IN')} deducted` : 'Rate × estimated area, always all-time, not scoped by the picker above'}
                        tone={data.deductedTotal > 0 ? 'danger' : undefined}
                    />
                </KpiGrid>

                {data.contractorBreakdown.length > 0 && (
                    <div className="list-table" style={{ marginTop: '24px', marginBottom: '24px' }}>
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

                {data.labourBreakdown.length > 0 && (
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

                <ChartGrid>
                    <ChartCard title={`Daily Cost/Sqft: ${data.scopeLabel}`}>
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
                        ) : <EmptyChart text={`No measurements ${scope === 'alltime' ? 'yet' : `for ${data.scopeLabel.toLowerCase()}`}.`} />}
                    </ChartCard>
                </ChartGrid>

                <div className="list-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: "1fr" }}><b>Material Used</b></div>
                    {data.materialUsed.length === 0 ? (
                        <div className="admin-empty-state"><p>No material used {scope === 'alltime' ? 'yet' : `for ${data.scopeLabel.toLowerCase()}`}.</p></div>
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
                        <div className="admin-empty-state"><p>No waste attributed to this work {scope === 'alltime' ? 'yet' : `for ${data.scopeLabel.toLowerCase()}`}.</p></div>
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
                            Recorded before per-work waste tracking existed, or entered without picking a work; shown here separately rather than silently folded into or excluded from this work&apos;s numbers.
                        </p>
                        {data.projectLevelWaste.map(m => (
                            <div key={m.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <p>{m.materialName}</p>
                                <p>{m.quantity} {m.unit}</p>
                            </div>
                        ))}
                    </div>
                )}

                <div className="list-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                        <b>Project Material Stock</b><b>Dumped/Purchased</b><b>Consumed</b><b>Current Stock</b>
                    </div>
                    <p className="admin-subtitle" style={{ padding: '0 20px 8px' }}>
                        Stock is tracked per project, not per Work; material dumped at this site can go to any Work here, so this is always current, not scoped by the selector above.
                    </p>
                    {data.materialStock.length === 0 ? (
                        <div className="admin-empty-state"><p>No material tracked at this project yet.</p></div>
                    ) : data.materialStock.map(m => (
                        <div key={m.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                            <p>{m.materialName}</p>
                            <p>{m.dump} {m.unit}</p>
                            <p>{m.consume} {m.unit}</p>
                            <p style={{ color: m.currentStock < 0 ? '#c0392b' : 'var(--moss)' }}>{m.currentStock} {m.unit}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WorkDetail;
