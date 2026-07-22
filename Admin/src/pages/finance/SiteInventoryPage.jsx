import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import StockMovementsManager from '../../components/finance/StockMovementsManager';
import { ChartCard, ChartGrid, EmptyChart, CHART_COLORS } from '../../components/finance/DashboardWidgets';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/dashboard.css';

/*
 * Tier-1 mini-dashboard for Site Inventory — current stock with a
 * below-minimum flag, a monthly consumption trend, and wastage rate
 * (wasted ÷ (wasted + consumed)) sorted highest-first, above the existing
 * project-picker + manual movement entry. `?filter=low-stock` (from the
 * Company Dashboard's Material Low Alerts KPI card) pre-filters the stock
 * table to only materials currently below their minimum.
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
        <FinanceTabShell label="Site Inventory" subtitle="Current stock, consumption trend, and wastage rate. Manual waste entry per project below; Dump/Return happen through Procurement's Purchase/Returns instead.">
            {!loading && stockTable.length > 0 && (
                <>
                    <ChartGrid>
                        <ChartCard title="Consumption Trend (monthly qty, top materials)">
                            {consumptionData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <LineChart data={consumptionData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Legend wrapperStyle={{ fontSize: 10 }} />
                                        {consumptionTrend.map((m, i) => (
                                            <Line key={m.materialId} type="monotone" dataKey={m.materialName} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={{ r: 2 }} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart text="No consumption recorded yet." />}
                        </ChartCard>
                        <ChartCard title="Wastage Rate: highest first">
                            {wastageData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={wastageData.slice(0, 10)} layout="vertical" margin={{ left: 24 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                                        <YAxis type="category" dataKey="materialName" tick={{ fontSize: 11 }} width={100} />
                                        <Tooltip formatter={(v) => `${v}%`} />
                                        <Bar dataKey="wastagePercent" name="Wastage %" radius={[0, 4, 4, 0]}>
                                            {wastageData.slice(0, 10).map((_, i) => <Cell key={i} fill={CHART_COLORS[2]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart text="No waste recorded yet." />}
                        </ChartCard>
                    </ChartGrid>

                    <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '280px 1fr 1fr 1fr 1fr' }}>
                            <b>Material</b><b>Current Stock</b><b>Minimum</b><b>Consumed</b><b>Wastage %</b>
                        </div>
                        {stockTable.map(r => (
                            <div key={r.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '280px 1fr 1fr 1fr 1fr' }}>
                                <p>{r.materialName}</p>
                                <p style={{ color: r.belowMinimum ? '#c0392b' : 'inherit', fontWeight: r.belowMinimum ? 600 : 400 }}>
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
                                <p>{r.minimumStockLevel} {r.unit}</p>
                                <p>{r.totalConsumed} {r.unit}</p>
                                <p>{Math.round(r.wastageRate * 1000) / 10}%</p>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project (for manual entry / movement history)</p>
                <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
                    <option value="">Select project…</option>
                    {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
            </div>
            {selectedProjectId
                ? <StockMovementsManager url={url} projectId={selectedProjectId} />
                : <div className="admin-empty-state"><p>Select a project to view its movement history or record waste.</p></div>}
        </FinanceTabShell>
    );
};

export default SiteInventoryPage;
