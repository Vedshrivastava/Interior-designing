import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import StockMovementsManager from '../../components/finance/StockMovementsManager';
import StyledSelect from '../../components/finance/StyledSelect';
import { ChartCard, ChartGrid, EmptyChart, ChartSkeleton, ChartTooltip, CHART_COLORS } from '../../components/finance/DashboardWidgets';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/dashboard.css';

/*
 * Tier-1 mini-dashboard for Site Inventory — current stock with a
 * below-minimum flag, dumped/returned/consumed/wasted per material (each
 * already tracked project-scoped at the FinanceStockMovement level — this
 * table just surfaces the breakdown instead of only the derived current-
 * stock/wastage-rate figures), a monthly consumption trend, and wastage
 * rate (wasted ÷ (wasted + consumed)) sorted highest-first, above the
 * existing project-picker + manual movement entry. `?filter=low-stock`
 * (from the Company Dashboard's Material Low Alerts KPI card) pre-filters
 * the stock table to only materials currently below their minimum.
 */
const SiteInventoryPage = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [searchParams] = useSearchParams();
    const lowStockOnly = searchParams.get('filter') === 'low-stock';

    const [projects, setProjects] = useState([]);
    // Pre-selects the project when arriving via `?projectId=` — e.g. the
    // "Open Site Inventory" link on a measurement's insufficient-stock
    // toast, so recording the Dump lands directly on the right project
    // instead of an empty picker.
    const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') || '');
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchSummary = () => {
        setLoading(true);
        const params = selectedProjectId ? { projectId: selectedProjectId } : {};
        axios.get(`${url}/api/finance/reports/inventory-summary`, { ...authHeader, params })
            .then(res => { if (res.data.success) setSummary(res.data.data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    };
    useEffect(fetchSummary, [url, selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps
    // Without this, the stock/consumption/wastage figures above stayed
    // frozen at whatever they were on page load — a Dump recorded just
    // below (or a measurement's auto-consume elsewhere) changed the real
    // number immediately, but this summary never knew until a full reload.
    useFinanceWsRefresh(['financeStockChanged'], fetchSummary);

    const stockTable = (summary?.stockTable || []).filter(r => !lowStockOnly || r.belowMinimum);
    const consumptionTrend = summary?.consumptionTrend || [];
    const monthSet = new Set(consumptionTrend.flatMap(m => m.points.map(p => p.month)));
    const consumptionData = [...monthSet].sort().map(month => {
        const row = { month };
        for (const m of consumptionTrend) {
            const point = m.points.find(p => p.month === month);
            if (point) row[m.materialName] = point.qty;
        }
        return row;
    });
    const wastageData = (summary?.wastageRateSorted || []).map(r => ({ ...r, wastagePercent: Math.round(r.wastageRate * 1000) / 10 }));

    return (
        <FinanceTabShell label="Site Inventory" subtitle="Current stock, dumped/returned/consumed/wasted per material, consumption trend, and wastage rate. Manual waste entry per project below; Dump/Return happen through Procurement's Purchase/Returns instead.">
            {(loading || stockTable.length > 0) && (
                <>
                    <ChartGrid>
                        <ChartCard title="Consumption Trend (monthly qty, top materials)">
                            {loading ? <ChartSkeleton /> : consumptionData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <LineChart data={consumptionData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 10 }} />
                                        {consumptionTrend.map((m, i) => (
                                            <Line key={m.materialId} type="monotone" dataKey={m.materialName} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={{ r: 2 }} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart text="No consumption recorded yet." />}
                        </ChartCard>
                        <ChartCard title="Wastage Rate: highest first">
                            {loading ? <ChartSkeleton /> : wastageData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={wastageData.slice(0, 10)} layout="vertical" margin={{ left: 24 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                                        <YAxis type="category" dataKey="materialName" tick={{ fontSize: 11 }} width={100} />
                                        <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v}%`} />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                        <Bar dataKey="wastagePercent" name="Wastage %" radius={[0, 4, 4, 0]} activeBar={false}>
                                            {wastageData.slice(0, 10).map((_, i) => <Cell key={i} fill={CHART_COLORS[2]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart text="No waste recorded yet." />}
                        </ChartCard>
                    </ChartGrid>

                    <div className="dash-chart-card si-card" style={{ marginBottom: '24px' }}>
                        <div className="si-row si-header">
                            <b className="si-material">Material</b>
                            <b className="si-stock">Current Stock</b>
                            <b className="si-minimum">Minimum</b>
                            <b className="si-dumped">Dumped</b>
                            <b className="si-returned">Returned</b>
                            <b className="si-consumed">Consumed</b>
                            <b className="si-wastage">Wastage</b>
                        </div>
                        {stockTable.map(r => (
                            <div key={r.materialId} className="si-row">
                                <p className="si-material">{r.materialName}</p>
                                <p className="si-stock" style={{ color: r.belowMinimum ? '#c0392b' : 'inherit', fontWeight: r.belowMinimum ? 600 : 400 }}>
                                    <span className="pq-group-label">Current Stock</span>
                                    {r.belowMinimum && '⚠ '}{r.currentStock} {r.unit}
                                    {/* Company-wide view only (no project selected) — a single blended
                                        total can't say which site is actually short, so this reports
                                        how many active projects are, same definition Dashboard uses. */}
                                    {!selectedProjectId && r.activeProjectCount != null && (
                                        <span className="admin-subtitle" style={{ display: 'block', fontWeight: 400, fontSize: '0.78rem' }}>
                                            {r.activeProjectCount === 0
                                                ? 'Not tracked at any active project'
                                                : `Low at ${r.lowAtProjectCount} of ${r.activeProjectCount} active project${r.activeProjectCount === 1 ? '' : 's'}`}
                                        </span>
                                    )}
                                </p>
                                <p className="si-minimum"><span className="pq-group-label">Minimum</span>{r.minimumStockLevel} {r.unit}</p>
                                <p className="si-dumped"><span className="pq-group-label">Dumped</span>{r.totalDumped} {r.unit}</p>
                                <p className="si-returned"><span className="pq-group-label">Returned</span>{r.totalReturned} {r.unit}</p>
                                <p className="si-consumed"><span className="pq-group-label">Consumed</span>{r.totalConsumed} {r.unit}</p>
                                <p className="si-wastage"><span className="pq-group-label">Wastage</span>{r.totalWasted} {r.unit} <span className="admin-subtitle" style={{ fontSize: '0.78rem' }}>({Math.round(r.wastageRate * 1000) / 10}%)</span></p>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project (for manual entry / movement history)</p>
                <StyledSelect
                    value={selectedProjectId} onChange={setSelectedProjectId} placeholder="Select project…"
                    options={projects.map(p => ({ value: p._id, label: p.name }))}
                />
            </div>
            {selectedProjectId
                ? <StockMovementsManager url={url} projectId={selectedProjectId} />
                : <div className="admin-empty-state"><p>Select a project to view its movement history or record waste.</p></div>}
        </FinanceTabShell>
    );
};

export default SiteInventoryPage;
