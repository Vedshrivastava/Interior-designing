import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { KpiCard, KpiGrid, KpiSectionLabel, ChartCard, ChartGrid, EmptyChart, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
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
                    <KpiCard label="Area Covered" value={`${data.areaCoveredSqft} sqft`} sub={`${data.scopeLabel}, not the all-time figures below`} />
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
                        value={`₹${data.averageCostPerSqft.toFixed(2)}`}
                        sub="Mean of each day's cost/sqft ratio, not total cost ÷ total area"
                    />
                    <KpiCard
                        label="Expected Pay (Net of Deductions)"
                        value={formatINR(data.expectedPayNetOfDeductions)}
                        sub={data.deductedTotal > 0 ? `₹${data.expectedPay.toLocaleString('en-IN')} expected − ₹${data.deductedTotal.toLocaleString('en-IN')} deducted` : 'Rate × estimated area, always all-time, not scoped by the picker above'}
                        tone={data.deductedTotal > 0 ? 'danger' : undefined}
                    />
                </KpiGrid>

                {/* Approved = reviewed (financeWorkReview), same meaning
                    "Approved" has everywhere else in the app now — always
                    all-time for this Work, never scoped by the Day/Month/
                    All Time picker above (review isn't a dated concept).
                    Area Approved/Contractor/Labour/Commission here are this
                    Work's own reviewed-and-billable figures; the same
                    still-unreviewed gap for each is broken out in its own
                    Unapproved table below instead of being blended in. */}
                <KpiSectionLabel>Approved — Reviewed (All-Time)</KpiSectionLabel>
                <KpiGrid>
                    <KpiCard label="Area Approved" value={`${data.approvedAreaSqft} sqft`} tone="good" sub={data.unapprovedAreaSqft > 0 ? `${data.unapprovedAreaSqft} sqft still pending review` : 'Everything logged so far is reviewed'} />
                    <KpiCard
                        label="Contractor Cost"
                        value={data.contractorCost > 0 ? formatINR(data.contractorCost) : (data.totalContractorAmount > 0 ? 'Unapproved' : formatINR(0))}
                        tone={data.contractorCost > 0 ? 'good' : (data.totalContractorAmount > 0 ? 'danger' : undefined)}
                        sub={data.totalContractorAmount > data.contractorCost ? `Total logged: ${formatINR(data.totalContractorAmount)}` : 'All-time'}
                    />
                    <KpiCard
                        label="Labour Cost"
                        value={data.labourCost > 0 ? formatINR(data.labourCost) : (data.totalLabourAmount > 0 ? 'Unapproved' : formatINR(0))}
                        tone={data.labourCost > 0 ? 'good' : (data.totalLabourAmount > 0 ? 'danger' : undefined)}
                        sub={data.totalLabourAmount > data.labourCost ? `Total logged: ${formatINR(data.totalLabourAmount)}` : 'All-time'}
                    />
                    <KpiCard
                        label="Commission Cost"
                        value={data.commissionCost > 0 ? formatINR(data.commissionCost) : (data.totalCommissionAmount > 0 ? 'Unapproved' : formatINR(0))}
                        tone={data.commissionCost > 0 ? 'good' : (data.totalCommissionAmount > 0 ? 'danger' : undefined)}
                        sub={data.totalCommissionAmount > data.commissionCost ? `Total logged: ${formatINR(data.totalCommissionAmount)}` : 'All-time'}
                    />
                </KpiGrid>

                {(data.totalContractorAmount > data.contractorCost || data.totalLabourAmount > data.labourCost || data.totalCommissionAmount > data.commissionCost) && (
                    <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr' }}><b>Unapproved (Pending Review)</b></div>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }}>
                            <b>Area</b><b>Contractor</b><b>Labour</b><b>Commission</b><b>Revenue</b><b>Profit</b>
                        </div>
                        <div className="list-table-format row-item unapproved-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }}>
                            <p>{data.unapprovedAreaSqft.toLocaleString('en-IN')} sqft</p>
                            <p>{formatINR(Math.max(0, data.totalContractorAmount - data.contractorCost))}</p>
                            <p>{formatINR(Math.max(0, data.totalLabourAmount - data.labourCost))}</p>
                            <p>{formatINR(data.unapprovedCommissionAmount)}</p>
                            <p>{formatINR(data.unapprovedRevenue)}</p>
                            <p style={{ color: data.unapprovedProfit >= 0 ? 'var(--moss)' : '#c0392b' }}>{formatINR(data.unapprovedProfit)}</p>
                        </div>
                        <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                            Logged work on this Work whose cost isn't counted in Profit yet — review it in Payables/Receivables → Deductions to move it in. Revenue/Profit here are what this same unapproved work would add once reviewed and billed.
                        </p>
                    </div>
                )}

                {data.contractorBreakdown.length > 0 && (
                    <div className="list-table finance-table" style={{ marginTop: '24px', marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.1fr' }}>
                            <b>Contractor</b><b>Area (sqft)</b><b>Rate</b><b>Earnings</b><b>Material Cost/Sqft</b>
                        </div>
                        {data.contractorBreakdown.map(b => (
                            <div key={b.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.1fr' }}>
                                <p>{b.vendorName}</p>
                                <p>{b.areaSqft}</p>
                                <p>₹{b.rate.toFixed(2)}</p>
                                <p>{formatINR(b.earnings)}</p>
                                <p>{b.materialCostPerSqft != null ? `₹${b.materialCostPerSqft.toFixed(2)}` : '—'}</p>
                            </div>
                        ))}
                        <p className="admin-subtitle" style={{ padding: '8px 20px 16px' }}>
                            Material Cost/Sqft is each contractor's own material use ÷ only the area they covered while logging it — compare across rows to see who gets the most coverage per unit of material.
                        </p>
                    </div>
                )}

                {data.labourBreakdown.length > 0 && (
                    <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.1fr' }}>
                            <b>Labourer</b><b>Area (sqft)</b><b>Rate</b><b>Earnings</b><b>Material Cost/Sqft</b>
                        </div>
                        {data.labourBreakdown.map(b => (
                            <div key={b.labourerId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.1fr' }}>
                                <p>{b.labourerName}</p>
                                <p>{b.areaSqft}</p>
                                <p>₹{b.rate.toFixed(2)}</p>
                                <p>{formatINR(b.earnings)}</p>
                                <p>{b.materialCostPerSqft != null ? `₹${b.materialCostPerSqft.toFixed(2)}` : '—'}</p>
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

                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
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

                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
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
                    <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
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

                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
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
