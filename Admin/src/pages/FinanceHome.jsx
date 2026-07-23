import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useFinanceWsRefresh } from '../hooks/useFinanceWsRefresh';
import {
    ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import {
    faMoneyBillTransfer, faArrowTrendUp, faBuildingColumns, faWallet, faFileInvoiceDollar,
    faCartShopping, faHardHat, faReceipt, faBuilding, faClipboardList, faPersonDigging,
    faRulerCombined, faTriangleExclamation, faMoneyBillWave, faHandHoldingDollar, faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { KpiCard, KpiGrid, KpiSectionLabel, ChartCard, ChartGrid, EmptyChart, ChartSkeleton, ActivityCard, ChartTooltip, CHART_COLORS, formatINR } from '../components/finance/DashboardWidgets';
import '../styles/welcome.css';
import '../styles/list.css';

// Salary for the current, still-in-progress month isn't owed yet — only
// once that month has fully ended, so this dashboard's salary-payable
// figure looks at the last completed month instead (see
// PayablesPage.jsx's identical helper/reasoning).
const lastCompletedMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
};

// Project names run long ("Malhotra Enterprises — HQ Advance Contract") and
// the chart's y-axis has nowhere near that much room — Recharts renders
// axis ticks as raw SVG text, so CSS text-overflow can't help; truncate the
// tick label itself instead (the tooltip below still shows the full name).
const truncateLabel = (name, max = 15) => (name.length > max ? `${name.slice(0, max - 1)}…` : name);

// Kept outside the component so it survives a route remount — navigating
// away and back to the dashboard shows the last-known view instantly
// instead of every card/chart reverting to its skeleton again, while a
// fresh fetch quietly brings it up to date in the background. Only a
// genuine first load (no cache yet) shows any skeleton at all.
let dashboardCache = null;

// Recharts' own Y-axis tick <Text> component applies its own word-wrapping
// against the axis `width`, which mangles long category labels in ways a
// tickFormatter alone can't prevent (different names truncate to wildly
// different, sometimes single-letter, lengths). A custom tick renders
// exactly the string we hand it — no further "helpful" wrapping.
const ProjectNameTick = ({ x, y, payload }) => (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="#5a5248">
        {truncateLabel(payload.value)}
    </text>
);

/*
 * Tier 0 — Company Dashboard. Answers "how's the business doing right now"
 * in ~10 seconds: KPI cards (every one a doorway into its Tier-1 home) plus
 * exactly four charts. Deliberately does NOT show granular tables here —
 * that's what clicking a card/chart element is for.
 */
const FinanceHome = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [summary, setSummary] = useState(null);
    const [trends, setTrends] = useState(null);
    const [projectProfits, setProjectProfits] = useState([]);
    const [payablesBreakdown, setPayablesBreakdown] = useState(null);
    // Two independent flags, not one — summary/trends resolve in the first
    // request batch, but projectProfits/payablesBreakdown depend on a
    // second, chained N+1 fan-out (salary/commission ledgers, per-project
    // profit) that's meaningfully slower. Gating everything behind a single
    // flag meant the whole page (including the KPI cards, which only need
    // the fast batch) sat behind a blank spinner waiting on the slow one.
    const [phase1Loading, setPhase1Loading] = useState(true);
    const [phase2Loading, setPhase2Loading] = useState(true);

    // Check-on-load, not a background job — no cron infrastructure exists
    // in this codebase. Silent: de-duplication (24h cooldown per
    // material/bill) and the actual notification happen server-side via
    // email; there's nothing for the dashboard itself to display.
    useEffect(() => {
        if (!token) return;
        axios.get(`${url}/api/finance/settings/check-alerts`, authHeader).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // Guards state updates after unmount for both the mount-triggered load
    // and any later WebSocket-triggered background refresh below.
    const aliveRef = useRef(true);
    useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

    const fetchDashboard = async () => {
        try {
            // Root requests fired together — employees/vendors/projects
            // don't depend on summary/trends (or each other), so there's
            // no reason to wait for one batch before starting the next.
            const month = lastCompletedMonth();
            const [summaryRes, trendsRes, employeesRes, referralsRes, projectsRes] = await Promise.all([
                axios.get(`${url}/api/finance/reports/dashboard-summary`, authHeader),
                axios.get(`${url}/api/finance/reports/dashboard-trends`, { ...authHeader, params: { months: 6 } }),
                axios.get(`${url}/api/finance/employees/list`, authHeader),
                axios.get(`${url}/api/finance/referrals/list`, authHeader),
                axios.get(`${url}/api/finance/projects/list`, authHeader),
            ]);
            if (!aliveRef.current) return;

            const nextSummary = summaryRes.data.success ? summaryRes.data.data : null;
            const nextTrends = trendsRes.data.success ? trendsRes.data.data : null;
            if (nextSummary) setSummary(nextSummary);
            if (nextTrends) setTrends(nextTrends);
            setPhase1Loading(false);

            // Payables breakdown donut — vendor/contractor come straight off
            // the summary; salary/commission need the same N+1 ledger
            // fan-out PayablesPage.jsx already does (no aggregate endpoint
            // exists for either), scoped to this month. Project Profitability
            // needs one profit call per active project — both fan-outs run
            // together since neither depends on the other.
            const employees = employeesRes.data.success ? employeesRes.data.data : [];
            const referrals = referralsRes.data.success ? referralsRes.data.data : [];
            const activeProjects = (projectsRes.data.success ? projectsRes.data.data : []).filter(p => p.status === 'active');

            const [salaryLedgers, commissionLedgers, profits] = await Promise.all([
                Promise.all(employees.map(e => axios.get(`${url}/api/finance/employees/${e._id}/salary-ledger`, { ...authHeader, params: { month } }).then(r => r.data.success ? r.data.data : null).catch(() => null))),
                Promise.all(referrals.map(r => axios.get(`${url}/api/finance/referrals/${r._id}/commission-ledger`, authHeader).then(res => res.data.success ? res.data.data : null).catch(() => null))),
                Promise.all(activeProjects.map(p => axios.get(`${url}/api/finance/reports/project-profit`, { ...authHeader, params: { projectId: p._id } })
                    .then(r => (r.data.success ? { projectId: p._id, projectName: p.name, profit: r.data.data.profit } : null))
                    .catch(() => null))),
            ]);
            if (!aliveRef.current) return;

            const salaryPayable = salaryLedgers.filter(Boolean).reduce((s, l) => s + (l.balanceDue || 0), 0);
            const commissionPayable = commissionLedgers.filter(Boolean).reduce((s, l) => s + (l.commissionPayable || 0), 0);
            const nextPayablesBreakdown = {
                vendor: nextSummary?.vendorPayables || 0,
                contractor: nextSummary?.contractorPayables || 0,
                salary: salaryPayable,
                commission: commissionPayable,
            };
            const nextProjectProfits = profits.filter(Boolean);

            setPayablesBreakdown(nextPayablesBreakdown);
            setProjectProfits(nextProjectProfits);
            setPhase2Loading(false);
            dashboardCache = {
                summary: nextSummary, trends: nextTrends,
                projectProfits: nextProjectProfits, payablesBreakdown: nextPayablesBreakdown,
            };
        } catch {
            // Dashboard degrades gracefully — a failed fetch just leaves
            // that section's empty state showing, no toast noise on load.
        } finally {
            if (aliveRef.current) { setPhase1Loading(false); setPhase2Loading(false); }
        }
    };

    useEffect(() => {
        if (dashboardCache) {
            setSummary(dashboardCache.summary);
            setTrends(dashboardCache.trends);
            setProjectProfits(dashboardCache.projectProfits);
            setPayablesBreakdown(dashboardCache.payablesBreakdown);
            setPhase1Loading(false);
            setPhase2Loading(false);
        } else {
            setPhase1Loading(true);
            setPhase2Loading(true);
        }
        fetchDashboard();
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // Nearly every finance mutation feeds into this dashboard's KPIs/charts
    // somewhere (revenue, cash, payables, labour, materials...), so rather
    // than maintain a brittle allow-list of ~20 event types, any finance
    // broadcast triggers a silent background refetch — cheap since it never
    // touches the loading flags (data's already on screen) or the cache
    // structure, just quietly replaces both when the response lands.
    useFinanceWsRefresh(['*'], fetchDashboard);

    const payablesData = payablesBreakdown ? [
        { name: 'Vendor', value: payablesBreakdown.vendor },
        { name: 'Contractor', value: payablesBreakdown.contractor },
        { name: 'Salary', value: payablesBreakdown.salary },
        { name: 'Commission', value: payablesBreakdown.commission },
    ].filter(d => d.value > 0) : [];

    // One box per work type present in today's measurements (Putty, Paint,
    // etc.) — a type can span several projects/works today, so this rolls
    // those up into a single glanceable figure per type, same KpiCard style
    // as the rest of Site Activity. The detailed by-work-by-project table
    // below still has the per-row breakdown for drilling in further.
    const measurementsByType = (summary?.todaysWorkActivity || []).reduce((acc, w) => {
        acc[w.workType] = (acc[w.workType] || 0) + w.sqft;
        return acc;
    }, {});
    const measurementTypeEntries = Object.entries(measurementsByType).sort((a, b) => b[1] - a[1]);

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <h1>Finance Dashboard</h1>
                        <p className="admin-subtitle">How the business is doing right now - click any card or chart to go deeper.</p>
                    </div>
                </div>

                <KpiGrid hero>
                    <KpiCard hero loading={phase1Loading} icon={faMoneyBillTransfer} label="This Month Revenue" value={formatINR(summary?.thisMonthRevenue)} onClick={() => navigate('/finance/receivables')} />
                    <KpiCard hero loading={phase1Loading} icon={faArrowTrendUp} label="This Month Profit" value={formatINR(summary?.thisMonthProfit)} onClick={() => navigate('/finance/reports?tab=project-profit')} tone={summary?.thisMonthProfit >= 0 ? 'good' : 'danger'} />
                    <KpiCard hero loading={phase1Loading} icon={faMoneyBillWave} label="This Month Expense" value={formatINR(summary?.thisMonthExpense)} onClick={() => navigate('/finance/payables?tab=expenses')} />
                </KpiGrid>

                <KpiSectionLabel>Cash, Receivables &amp; Payables</KpiSectionLabel>
                <KpiGrid>
                    <KpiCard loading={phase1Loading} icon={faBuildingColumns} label="Cash in Bank" value={formatINR(summary?.cashInBank)} onClick={() => navigate('/finance/bank')} />
                    <KpiCard loading={phase1Loading} icon={faWallet} label="Cash in Hand" value={formatINR(summary?.cashInHand)} onClick={() => navigate('/finance/cash-book')} />
                    <KpiCard loading={phase1Loading} icon={faFileInvoiceDollar} label="Client Receivables" value={formatINR(summary?.clientReceivables)} onClick={() => navigate('/finance/clients')} tone={summary?.clientReceivables > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faCartShopping} label="Vendor Payables" value={formatINR(summary?.vendorPayables)} onClick={() => navigate('/finance/procurement')} tone={summary?.vendorPayables > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faHardHat} label="Contractor Payables" value={formatINR(summary?.contractorPayables)} onClick={() => navigate('/finance/contractors')} tone={summary?.contractorPayables > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faPersonDigging} label="Labour Payables" value={formatINR(summary?.labourPayables)} onClick={() => navigate('/finance/daily-labour')} tone={summary?.labourPayables > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faHandHoldingDollar} label="Commission Payables" value={formatINR(summary?.commissionPayables)} onClick={() => navigate('/finance/referrals')} tone={summary?.commissionPayables > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faUsers} label="Salaries Payable This Month" value={formatINR(summary?.salaryExpectedThisMonth)}
                        sub={`Payment left: ${formatINR(summary?.salaryPayables)}`}
                        onClick={() => navigate('/finance/payables?tab=salary')} tone={summary?.salaryOverdue ? 'danger' : undefined} />
                    <KpiCard loading={phase1Loading} icon={faReceipt} label="Running Bills Ready" value={summary?.runningBillsReady ?? 0} onClick={() => navigate('/finance/receivables')} />
                </KpiGrid>

                <KpiSectionLabel>Site Activity</KpiSectionLabel>
                <KpiGrid>
                    <KpiCard loading={phase1Loading} icon={faBuilding} label="Active Projects" value={summary?.activeProjects ?? 0} onClick={() => navigate('/finance/projects')} />
                    <KpiCard loading={phase1Loading} icon={faClipboardList} label="Active Works" value={summary?.activeWorks ?? 0} onClick={() => navigate('/finance/projects')} />
                    <KpiCard loading={phase1Loading} icon={faPersonDigging} label="Personal Labour Working Today" value={summary?.labourWorkingToday ?? 0} onClick={() => navigate('/finance/daily-labour')} />
                    <KpiCard loading={phase1Loading} icon={faHardHat} label="Contractor Teams - Today" value={`${(summary?.todaysContractorMeasurementSqft || 0).toLocaleString('en-IN')} sqft`} onClick={() => navigate('/finance/contractors')} />
                    <KpiCard loading={phase1Loading} icon={faPersonDigging} label="Labour Teams - Today" value={`${(summary?.todaysLabourMeasurementSqft || 0).toLocaleString('en-IN')} sqft`} onClick={() => navigate('/finance/daily-labour')} />
                    <KpiCard loading={phase1Loading} icon={faTriangleExclamation} label="Material Low Alerts" value={summary?.materialLowAlerts ?? 0} onClick={() => navigate('/finance/site-inventory?filter=low-stock')} tone={summary?.materialLowAlerts > 0 ? 'danger' : 'good'} />
                </KpiGrid>

                {/* One box per work type measured today (Putty, Paint, TV
                    Unit...), rolled up across every project — replaces the
                    single blended "Today's Measurement" total with a
                    breakdown of what kind of work actually happened. */}
                {(phase1Loading || measurementTypeEntries.length > 0) && (
                    <KpiGrid>
                        {phase1Loading ? (
                            <KpiCard loading icon={faRulerCombined} label="Today's Measurements by Type" value="" />
                        ) : measurementTypeEntries.map(([workType, sqft]) => (
                            <KpiCard key={workType} icon={faRulerCombined} label={`${workType} - Today`} value={`${sqft.toLocaleString('en-IN')} sqft`} onClick={() => navigate('/finance/site-operations')} />
                        ))}
                    </KpiGrid>
                )}

                {/* Approved = reviewed (financeWorkReview), the same meaning
                    "Approved" has everywhere else in the app now (Contractor/
                    Labour/Commission/Labour Provider Ledgers) — cumulative,
                    not a "today" concept like the boxes above (a review
                    doesn't expire). Unapproved is its direct counterpart:
                    the same measured work, logged but not yet reviewed —
                    still a real prospective cost, just not payable yet, so
                    it gets its own section rather than being invisible
                    until someone opens a specific contractor's ledger. */}
                {(phase1Loading || (summary?.approvedByWorkType?.length > 0)) && (
                    <>
                        <KpiSectionLabel>Approved - Reviewed</KpiSectionLabel>
                        <KpiGrid>
                            {phase1Loading ? (
                                <KpiCard loading icon={faReceipt} label="Approved" value="" />
                            ) : (
                                <>
                                    <KpiCard icon={faHardHat} label="Contractor Teams - Approved" value={formatINR(summary.approvedContractorTotal)} onClick={() => navigate('/finance/contractors')} tone="good" />
                                    <KpiCard icon={faPersonDigging} label="Labour Teams - Approved" value={formatINR(summary.approvedLabourTotal)} onClick={() => navigate('/finance/daily-labour')} tone="good" />
                                    {summary.approvedByWorkType.map(({ workType, sqft, amount }) => (
                                        <KpiCard key={workType} icon={faReceipt} label={`${workType} - Approved`} value={`${sqft.toLocaleString('en-IN')} sqft`} sub={formatINR(amount)} onClick={() => navigate('/finance/receivables')} />
                                    ))}
                                </>
                            )}
                        </KpiGrid>
                    </>
                )}

                {(phase1Loading || (summary?.unapprovedByWorkType?.length > 0) || summary?.unapprovedCommissionTotal > 0) && (
                    <>
                        <KpiSectionLabel>Unapproved - Pending Review</KpiSectionLabel>
                        <KpiGrid>
                            {phase1Loading ? (
                                <KpiCard loading icon={faTriangleExclamation} label="Unapproved" value="" />
                            ) : (
                                <>
                                    <KpiCard icon={faHardHat} label="Contractor Teams - Unapproved" value={formatINR(summary.unapprovedContractorTotal)} onClick={() => navigate('/finance/contractors')} tone={summary.unapprovedContractorTotal > 0 ? 'danger' : undefined} />
                                    <KpiCard icon={faPersonDigging} label="Labour Teams - Unapproved" value={formatINR(summary.unapprovedLabourTotal)} onClick={() => navigate('/finance/daily-labour')} tone={summary.unapprovedLabourTotal > 0 ? 'danger' : undefined} />
                                    <KpiCard icon={faHandHoldingDollar} label="Commission - Unapproved" value={formatINR(summary.unapprovedCommissionTotal)} onClick={() => navigate('/finance/referrals')} tone={summary.unapprovedCommissionTotal > 0 ? 'danger' : undefined} />
                                    <KpiCard icon={faArrowTrendUp} label="Profit - Unapproved" value={formatINR(summary.unapprovedProfitTotal)} sub={`Revenue once approved: ${formatINR(summary.unapprovedRevenueTotal)}`} onClick={() => navigate('/finance/receivables')} tone={summary.unapprovedProfitTotal >= 0 ? 'good' : 'danger'} />
                                    {summary.unapprovedByWorkType.map(({ workType, sqft, amount }) => (
                                        <KpiCard key={workType} icon={faTriangleExclamation} label={`${workType} - Unapproved`} value={`${sqft.toLocaleString('en-IN')} sqft`} sub={`Revenue once approved: ${formatINR(amount)}`} onClick={() => navigate('/finance/receivables')} tone={amount > 0 ? 'danger' : undefined} />
                                    ))}
                                </>
                            )}
                        </KpiGrid>
                    </>
                )}

                <ChartGrid>
                    <ChartCard title="Revenue vs Cost - last 6 months">
                        {phase1Loading ? <ChartSkeleton /> : trends?.revenueVsCost?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <ComposedChart data={trends.revenueVsCost}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} activeBar={false} />
                                    <Line type="monotone" dataKey="cost" name="Cost" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 3 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart />}
                    </ChartCard>

                    <ChartCard title="Cash Flow - last 30 days">
                        {phase1Loading ? <ChartSkeleton /> : trends?.cashFlowSeries?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={trends.cashFlowSeries}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis dataKey="bucket" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Area type="monotone" dataKey="in" name="In" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.15} />
                                    <Area type="monotone" dataKey="out" name="Out" stroke={CHART_COLORS[2]} fill={CHART_COLORS[2]} fillOpacity={0.15} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart />}
                    </ChartCard>

                    <ChartCard title="Project Profitability">
                        {phase2Loading ? <ChartSkeleton /> : projectProfits.length > 0 ? (
                            <ResponsiveContainer width="100%" height={Math.max(260, projectProfits.length * 38)}>
                                <ComposedChart data={projectProfits} layout="vertical" margin={{ left: 24 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                    <YAxis
                                        type="category" dataKey="projectName" width={110}
                                        tick={<ProjectNameTick />} interval={0}
                                    />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                    <Bar
                                        dataKey="profit" name="Profit" radius={[0, 4, 4, 0]}
                                        onClick={(d) => navigate(`/finance/projects/${d.projectId}`)}
                                        style={{ cursor: 'pointer' }}
                                        activeBar={false}
                                    >
                                        {projectProfits.map((p, i) => <Cell key={i} fill={p.profit >= 0 ? CHART_COLORS[0] : CHART_COLORS[2]} />)}
                                    </Bar>
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart text="No active projects yet." />}
                    </ChartCard>

                    <ChartCard title="Payables Breakdown">
                        {phase2Loading ? <ChartSkeleton /> : payablesData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie data={payablesData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                                        {payablesData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart text="Nothing payable right now." />}
                    </ChartCard>
                </ChartGrid>

                <ActivityCard
                    title="Recent Activity"
                    loading={phase1Loading}
                    items={summary?.recentActivities}
                    onViewAll={() => navigate('/finance/activity')}
                    renderRow={(a) => (
                        <div key={a._id} className="dash-activity-row">
                            <span className="dash-activity-date">{new Date(a.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                            <span className="dash-activity-summary">{a.summary}</span>
                            <span className="dash-activity-amount">{a.amount != null ? formatINR(a.amount) : ''}</span>
                        </div>
                    )}
                />
            </div>
        </div>
    );
};

export default FinanceHome;
