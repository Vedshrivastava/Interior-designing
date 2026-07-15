import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import {
    faMoneyBillTransfer, faArrowTrendUp, faBuildingColumns, faWallet, faFileInvoiceDollar,
    faCartShopping, faHardHat, faReceipt, faBuilding, faClipboardList, faPersonDigging,
    faRulerCombined, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { KpiCard, KpiGrid, KpiSectionLabel, ChartCard, ChartGrid, EmptyChart, ActivityCard, ChartTooltip, CHART_COLORS, formatINR } from '../components/finance/DashboardWidgets';
import '../styles/welcome.css';
import '../styles/list.css';

const thisMonth = () => new Date().toISOString().slice(0, 7);

// Project names run long ("Malhotra Enterprises — HQ Advance Contract") and
// the chart's y-axis has nowhere near that much room — Recharts renders
// axis ticks as raw SVG text, so CSS text-overflow can't help; truncate the
// tick label itself instead (the tooltip below still shows the full name).
const truncateLabel = (name, max = 15) => (name.length > max ? `${name.slice(0, max - 1)}…` : name);

// Kept outside the component so it survives a route remount — navigating
// away and back to the dashboard shows the last-known view instantly
// instead of blanking to a spinner again, while a fresh fetch quietly
// brings it up to date in the background. Only a genuine first load (no
// cache yet) shows the full loading state.
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
    const [loading, setLoading] = useState(true);

    // Check-on-load, not a background job — no cron infrastructure exists
    // in this codebase. Silent: de-duplication (24h cooldown per
    // material/bill) and the actual notification happen server-side via
    // email; there's nothing for the dashboard itself to display.
    useEffect(() => {
        if (!token) return;
        axios.get(`${url}/api/finance/settings/check-alerts`, authHeader).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        let cancelled = false;

        if (dashboardCache) {
            setSummary(dashboardCache.summary);
            setTrends(dashboardCache.trends);
            setProjectProfits(dashboardCache.projectProfits);
            setPayablesBreakdown(dashboardCache.payablesBreakdown);
            setLoading(false);
        } else {
            setLoading(true);
        }

        (async () => {
            try {
                // Root requests fired together — employees/vendors/projects
                // don't depend on summary/trends (or each other), so there's
                // no reason to wait for one batch before starting the next.
                const month = thisMonth();
                const [summaryRes, trendsRes, employeesRes, vendorsRes, projectsRes] = await Promise.all([
                    axios.get(`${url}/api/finance/reports/dashboard-summary`, authHeader),
                    axios.get(`${url}/api/finance/reports/dashboard-trends`, { ...authHeader, params: { months: 6 } }),
                    axios.get(`${url}/api/finance/employees/list`, authHeader),
                    axios.get(`${url}/api/finance/vendors/list`, authHeader),
                    axios.get(`${url}/api/finance/projects/list`, authHeader),
                ]);
                if (cancelled) return;

                const nextSummary = summaryRes.data.success ? summaryRes.data.data : null;
                const nextTrends = trendsRes.data.success ? trendsRes.data.data : null;
                if (nextSummary) setSummary(nextSummary);
                if (nextTrends) setTrends(nextTrends);

                // Payables breakdown donut — vendor/contractor come straight off
                // the summary; salary/commission need the same N+1 ledger
                // fan-out PayablesPage.jsx already does (no aggregate endpoint
                // exists for either), scoped to this month. Project Profitability
                // needs one profit call per active project — both fan-outs run
                // together since neither depends on the other.
                const employees = employeesRes.data.success ? employeesRes.data.data : [];
                const referralVendors = (vendorsRes.data.success ? vendorsRes.data.data : []).filter(v => v.vendorType === 'referral');
                const activeProjects = (projectsRes.data.success ? projectsRes.data.data : []).filter(p => p.status === 'active');

                const [salaryLedgers, commissionLedgers, profits] = await Promise.all([
                    Promise.all(employees.map(e => axios.get(`${url}/api/finance/employees/${e._id}/salary-ledger`, { ...authHeader, params: { month } }).then(r => r.data.success ? r.data.data : null).catch(() => null))),
                    Promise.all(referralVendors.map(v => axios.get(`${url}/api/finance/vendors/${v._id}/commission-ledger`, authHeader).then(r => r.data.success ? r.data.data : null).catch(() => null))),
                    Promise.all(activeProjects.map(p => axios.get(`${url}/api/finance/reports/project-profit`, { ...authHeader, params: { projectId: p._id } })
                        .then(r => (r.data.success ? { projectId: p._id, projectName: p.name, profit: r.data.data.profit } : null))
                        .catch(() => null))),
                ]);
                if (cancelled) return;

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
                dashboardCache = {
                    summary: nextSummary, trends: nextTrends,
                    projectProfits: nextProjectProfits, payablesBreakdown: nextPayablesBreakdown,
                };
            } catch {
                // Dashboard degrades gracefully — a failed fetch just leaves
                // that section's empty state showing, no toast noise on load.
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const payablesData = payablesBreakdown ? [
        { name: 'Vendor', value: payablesBreakdown.vendor },
        { name: 'Contractor', value: payablesBreakdown.contractor },
        { name: 'Salary', value: payablesBreakdown.salary },
        { name: 'Commission', value: payablesBreakdown.commission },
    ].filter(d => d.value > 0) : [];

    if (loading) {
        return (
            <div className="dash-page-loader">
                <div className="loader-modal-box">
                    <div className="loader-ring"></div>
                    <p>Loading Dashboard</p>
                    <span>Gathering the latest numbers...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <h1>Finance Dashboard</h1>
                        <p className="admin-subtitle">How the business is doing right now — click any card or chart to go deeper.</p>
                    </div>
                </div>

                <KpiGrid hero>
                    <KpiCard hero goldAccent icon={faMoneyBillTransfer} label="This Month Revenue" value={formatINR(summary?.thisMonthRevenue)} onClick={() => navigate('/finance/receivables')} />
                    <KpiCard hero goldAccent icon={faArrowTrendUp} label="This Month Profit" value={formatINR(summary?.thisMonthProfit)} onClick={() => navigate('/finance/reports?tab=project-profit')} tone={summary?.thisMonthProfit >= 0 ? 'good' : 'danger'} />
                </KpiGrid>

                <KpiSectionLabel>Cash &amp; Receivables</KpiSectionLabel>
                <KpiGrid>
                    <KpiCard icon={faBuildingColumns} label="Cash in Bank" value={formatINR(summary?.cashInBank)} onClick={() => navigate('/finance/bank')} />
                    <KpiCard icon={faWallet} label="Cash in Hand" value={formatINR(summary?.cashInHand)} onClick={() => navigate('/finance/cash-book')} />
                    <KpiCard icon={faFileInvoiceDollar} label="Client Receivables" value={formatINR(summary?.clientReceivables)} onClick={() => navigate('/finance/clients')} tone={summary?.clientReceivables > 0 ? 'danger' : 'good'} />
                    <KpiCard icon={faCartShopping} label="Vendor Payables" value={formatINR(summary?.vendorPayables)} onClick={() => navigate('/finance/procurement')} />
                    <KpiCard icon={faHardHat} label="Contractor Payables" value={formatINR(summary?.contractorPayables)} onClick={() => navigate('/finance/contractors')} />
                    <KpiCard icon={faReceipt} label="Running Bills Ready" value={summary?.runningBillsReady ?? 0} onClick={() => navigate('/finance/receivables')} />
                </KpiGrid>

                <KpiSectionLabel>Site Activity</KpiSectionLabel>
                <KpiGrid>
                    <KpiCard icon={faBuilding} label="Active Projects" value={summary?.activeProjects ?? 0} onClick={() => navigate('/finance/projects')} />
                    <KpiCard icon={faClipboardList} label="Active Works" value={summary?.activeWorks ?? 0} onClick={() => navigate('/finance/projects')} />
                    <KpiCard icon={faPersonDigging} label="Labour Working Today" value={summary?.labourWorkingToday ?? 0} onClick={() => navigate('/finance/daily-labour')} />
                    <KpiCard icon={faRulerCombined} label="Today's Measurement" value={`${(summary?.todaysMeasurementSqft || 0).toLocaleString('en-IN')} sqft`} onClick={() => navigate('/finance/site-operations')} />
                    <KpiCard icon={faTriangleExclamation} label="Material Low Alerts" value={summary?.materialLowAlerts ?? 0} onClick={() => navigate('/finance/site-inventory?filter=low-stock')} tone={summary?.materialLowAlerts > 0 ? 'danger' : 'good'} />
                </KpiGrid>

                <ChartGrid>
                    <ChartCard title="Revenue vs Cost — last 6 months">
                        {trends?.revenueVsCost?.length > 0 ? (
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

                    <ChartCard title="Cash Flow — last 30 days">
                        {trends?.cashFlowSeries?.length > 0 ? (
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
                        {projectProfits.length > 0 ? (
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
                        {payablesData.length > 0 ? (
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
