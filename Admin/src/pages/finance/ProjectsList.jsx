import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { ChartCard, ChartGrid, EmptyChart, ChartSkeleton, ChartTooltip, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/dashboard.css';

const CONTRACT_TYPE_LABEL = { with_material: 'With Material', without_material: 'Without Material', advance: 'Advance' };
const STATUS_LABEL = { draft: 'Draft', active: 'Active', completed: 'Completed' };
const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material', 'advance'];

// Kept outside the component so they survive a route remount, same
// dashboardCache pattern as FinanceHome.jsx/ClientsPage.jsx — revisiting
// All Projects paints instantly from the last-known list/stats instead of
// every chart/row reverting to a loading state, while a fresh fetch
// quietly brings both up to date in the background. Two separate caches
// since the list resolves fast and the stats depend on a slower N+1
// fan-out chained off it.
let projectsListCache = null;
let projectsStatsCache = null; // { profitData, billedVsCollected }

const ProjectsList = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [list, setList] = useState(projectsListCache || []);
    const [loading, setLoading] = useState(!projectsListCache);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [profitData, setProfitData] = useState(projectsStatsCache?.profitData || []);
    const [billedVsCollected, setBilledVsCollected] = useState(projectsStatsCache?.billedVsCollected || []);
    const [statsLoading, setStatsLoading] = useState(!projectsStatsCache);

    const fetchList = async () => {
        if (!projectsListCache) setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/projects/list`, authHeader);
            if (res.data.success) { setList(res.data.data); projectsListCache = res.data.data; }
        } catch { toast.error('Error fetching projects'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchList(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // A fresh fetchList() always hands back a new array reference (even when
    // the underlying data is unchanged), so it alone is enough to also
    // re-trigger the stats effect below via its [list] dependency — no need
    // for a second, separate refresh path. Covers both project-master events
    // and everything the profit/billed-vs-collected stats are built from.
    useFinanceWsRefresh([
        'financeProjectsChanged', 'financeWorkTypeRatesChanged', 'financeContractorRatesChanged',
        'financeRunningBillsChanged', 'financeStockChanged', 'financeWorksChanged', 'financeMeasurementsChanged',
        'financeExpensesChanged', 'financeLabourMeasurementsChanged', 'financeLabourRatesChanged', 'financeReceiptsChanged',
    ], fetchList);

    // Mini-dashboard stats — profitability per active project, and
    // %billed-vs-collected per billable project (all three contract
    // types now — advance draws its credit down against its own bills).
    useEffect(() => {
        if (list.length === 0) {
            if (!projectsStatsCache) { setProfitData([]); setBilledVsCollected([]); }
            // The list itself might just still be loading (empty for now,
            // not confirmed empty) — only report these stats as "not
            // loading" once the list fetch has genuinely finished.
            setStatsLoading(projectsStatsCache ? false : loading);
            return;
        }
        if (!projectsStatsCache) setStatsLoading(true);
        let cancelled = false;
        (async () => {
            const activeProjects = list.filter(p => p.status === 'active');
            const profits = await Promise.all(activeProjects.map(p =>
                axios.get(`${url}/api/finance/reports/project-profit`, { ...authHeader, params: { projectId: p._id } })
                    .then(r => (r.data.success ? { projectName: p.name, projectId: p._id, profit: r.data.data.profit } : null))
                    .catch(() => null)
            ));
            const nextProfitData = profits.filter(Boolean);
            if (!cancelled) setProfitData(nextProfitData);

            const billableProjects = list.filter(p => BILLABLE_CONTRACT_TYPES.includes(p.contractType));
            const receivables = await Promise.all(billableProjects.map(p =>
                axios.get(`${url}/api/finance/receivables/summary`, { ...authHeader, params: { projectId: p._id } })
                    .then(r => (r.data.success ? { projectName: p.name, projectId: p._id, billed: r.data.data.issuedTotal, collected: r.data.data.receivedTotal } : null))
                    .catch(() => null)
            ));
            const nextBilledVsCollected = receivables.filter(Boolean).filter(r => r.billed > 0);
            if (!cancelled) {
                setBilledVsCollected(nextBilledVsCollected);
                projectsStatsCache = { profitData: nextProfitData, billedVsCollected: nextBilledVsCollected };
                setStatsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

    const contractTypeData = Object.entries(
        list.reduce((acc, p) => { acc[p.contractType] = (acc[p.contractType] || 0) + 1; return acc; }, {})
    ).map(([type, count]) => ({ name: CONTRACT_TYPE_LABEL[type] || type, value: count }));

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/remove`, { _id: confirmItem._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing project'); }
        finally { setDeleting(false); }
    };

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <h1>All Projects</h1>
                        <p className="admin-subtitle">Finance-tracked projects: contract type, rates, and readiness to go live.</p>
                    </div>
                    <button type="button" className="add-point-btn" onClick={() => navigate('/finance/projects/new')}>+ New Project</button>
                </div>

                <ChartGrid>
                    <ChartCard title="Profitability: active projects">
                        {loading || statsLoading ? <ChartSkeleton /> : profitData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={profitData} layout="vertical" margin={{ left: 24 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="projectName" tick={{ fontSize: 11 }} width={110} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                    <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]} onClick={(d) => navigate(`/finance/projects/${d.projectId}`)} style={{ cursor: 'pointer' }}>
                                        {profitData.map((p, i) => <Cell key={i} fill={p.profit >= 0 ? CHART_COLORS[0] : CHART_COLORS[2]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart text="No active projects yet." />}
                    </ChartCard>

                    <ChartCard title="Breakdown by contract type">
                        {loading ? <ChartSkeleton /> : contractTypeData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie data={contractTypeData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                                        {contractTypeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} project${v === 1 ? '' : 's'}`} />} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart text="No projects yet." />}
                    </ChartCard>

                    <ChartCard title="% Billed vs Collected">
                        {loading || statsLoading ? <ChartSkeleton /> : billedVsCollected.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={billedVsCollected} layout="vertical" margin={{ left: 24 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="projectName" tick={{ fontSize: 11 }} width={110} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="billed" name="Billed" fill={CHART_COLORS[1]} onClick={(d) => navigate(`/finance/projects/${d.projectId}`)} style={{ cursor: 'pointer' }} />
                                    <Bar dataKey="collected" name="Collected" fill={CHART_COLORS[0]} onClick={(d) => navigate(`/finance/projects/${d.projectId}`)} style={{ cursor: 'pointer' }} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart text="No bills issued yet." />}
                    </ChartCard>
                </ChartGrid>

                <div className="list-table finance-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1.3fr 1fr 1fr 1fr 100px' }}>
                        <b>Name</b><b>Client</b><b>Contract Type</b><b>Status</b><b>Readiness</b><b>Action</b>
                    </div>
                    {loading ? (
                        <div className="admin-empty-state"><p>Loading…</p></div>
                    ) : list.length === 0 ? (
                        <div className="admin-empty-state"><p>No projects yet: start with "+ New Project".</p></div>
                    ) : (
                        list.map(item => (
                            <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1.3fr 1fr 1fr 1fr 100px' }}>
                                <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/projects/${item._id}`)}>{item.name}</p>
                                <p>{item.clientId?.name || '-'}</p>
                                <p><span className="item-category">{CONTRACT_TYPE_LABEL[item.contractType]}</span></p>
                                <p><span className="item-category">{STATUS_LABEL[item.status]}</span></p>
                                <p>
                                    {item.readiness?.ready
                                        ? <span style={{ color: 'var(--moss)' }}>✓ Ready</span>
                                        : <span title={item.readiness?.missing?.join(', ')} style={{ color: '#c0392b' }}>⚠ Missing {item.readiness?.missing?.length}</span>}
                                </p>
                                <div className="action-buttons">
                                    <p onClick={() => navigate(`/finance/projects/${item._id}`)} className="cursor edit-action">View</p>
                                    <p onClick={() => setConfirmItem(item)} className="cursor delete-action">X</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove Project?</h3>
                        <p className="bin-confirm-name">"{confirmItem.name}"</p>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ProjectsList;
