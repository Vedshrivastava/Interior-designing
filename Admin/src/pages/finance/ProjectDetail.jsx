import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import WorkTypeRatesManager from '../../components/finance/WorkTypeRatesManager';
import TeamRatesManager from '../../components/finance/TeamRatesManager';
import WorksManager from '../../components/finance/WorksManager';
import MeasurementsManager from '../../components/finance/MeasurementsManager';
import StockMovementsManager from '../../components/finance/StockMovementsManager';
import RunningBillsManager from '../../components/finance/RunningBillsManager';
import ReceiptsManager from '../../components/finance/ReceiptsManager';
import DailyLabourManager from '../../components/finance/DailyLabourManager';
import DailyLabourBatchEntry from '../../components/finance/DailyLabourBatchEntry';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import { KpiCard, KpiGrid, ChartCard, ChartGrid, EmptyChart, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
import '../../styles/list.css';
import '../../styles/dashboard.css';

const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material'];

/*
 * Tier-2 dashboard for one project — KPI cards (revenue through
 * margin%), a progress-over-time chart, a cost-breakdown donut, the
 * material analysis table, and receivable status. Reuses the same
 * report endpoints Reports already computes off of — nothing recomputed
 * client-side.
 */
const ProjectOverviewTab = ({ url, projectId, contractType, onViewWorks }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [profit, setProfit] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [receivable, setReceivable] = useState(null);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const requests = [
                    axios.get(`${url}/api/finance/reports/project-profit`, { ...authHeader, params: { projectId } }),
                    axios.get(`${url}/api/finance/reports/material-analysis`, { ...authHeader, params: { projectId } }),
                    axios.get(`${url}/api/finance/purchases/list`, { ...authHeader, params: { projectId } }),
                ];
                if (BILLABLE_CONTRACT_TYPES.includes(contractType)) {
                    requests.push(axios.get(`${url}/api/finance/receivables/summary`, { ...authHeader, params: { projectId } }));
                }
                const [profitRes, materialRes, purchasesRes, receivableRes] = await Promise.all(requests);
                if (cancelled) return;
                if (profitRes.data.success) setProfit(profitRes.data.data);
                if (materialRes.data.success) setMaterials(materialRes.data.data);
                if (purchasesRes.data.success) {
                    const byVendor = new Map();
                    for (const p of purchasesRes.data.data) {
                        if (!p.vendorId) continue;
                        const key = p.vendorId._id || p.vendorId;
                        if (!byVendor.has(key)) byVendor.set(key, { vendorId: key, vendorName: p.vendorId.name || '—', totalPurchased: 0 });
                        byVendor.get(key).totalPurchased += p.totalAmount;
                    }
                    setVendors([...byVendor.values()]);
                }
                if (receivableRes?.data.success) setReceivable(receivableRes.data.data);
            } catch {
                // Overview degrades gracefully — sections just show empty state.
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url, projectId, contractType]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!profit) return <div className="admin-empty-state"><p>Unable to load project profitability.</p></div>;

    const costBreakdown = [
        { name: 'Material', value: profit.materialCost },
        { name: 'Contractor', value: profit.contractorCost },
        { name: 'Commission', value: profit.commissionCost },
        { name: 'Daily Labour', value: profit.dailyLabourCost },
        { name: 'Other Expenses', value: profit.otherExpenses },
    ].filter(d => d.value > 0);

    return (
        <div>
            <KpiGrid>
                <KpiCard label="Revenue" value={formatINR(profit.revenue)} />
                <KpiCard label="Material Cost" value={formatINR(profit.materialCost)} />
                <KpiCard label="Contractor Cost" value={formatINR(profit.contractorCost)} />
                <KpiCard label="Commission Cost" value={formatINR(profit.commissionCost)} />
                <KpiCard label="Daily Labour Cost" value={formatINR(profit.dailyLabourCost)} />
                <KpiCard label="Other Expenses" value={formatINR(profit.otherExpenses)} />
                <KpiCard label="Profit" value={formatINR(profit.profit)} tone={profit.profit >= 0 ? 'good' : 'danger'} />
                <KpiCard label="Margin %" value={`${Math.round(profit.marginPercent * 10) / 10}%`} tone={profit.marginPercent >= 0 ? 'good' : 'danger'} />
            </KpiGrid>

            <ChartGrid>
                <ChartCard title="Progress Over Time">
                    {profit.progressOverTime?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={profit.progressOverTime}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Line type="monotone" dataKey="completedAreaSqft" name="Completed Sqft" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 2 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart text="No measurements logged yet." />}
                </ChartCard>

                <ChartCard title="Cost Breakdown">
                    {costBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie data={costBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                                    {costBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v) => formatINR(v)} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart text="No costs recorded yet." />}
                </ChartCard>
            </ChartGrid>

            {receivable && (
                <div className="list-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: "1fr" }}><b>Receivable Status</b></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <p>Billed: {formatINR(receivable.issuedTotal)}</p>
                        <p>Received: {formatINR(receivable.receivedTotal)}</p>
                        <p style={{ color: receivable.balance > 0 ? '#c0392b' : 'var(--moss)' }}>Outstanding: {formatINR(receivable.balance)}</p>
                    </div>
                </div>
            )}

            {materials.length > 0 && (
                <div className="list-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1fr' }}>
                        <b>Material</b><b>Purchased</b><b>Consumed</b><b>Wasted</b><b>Current Stock</b><b>Avg Cost</b>
                    </div>
                    {materials.map(m => (
                        <div key={m.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1fr' }}>
                            <p>{m.materialName}</p>
                            <p>{m.totalPurchased} {m.unit}</p>
                            <p>{m.totalConsumed} {m.unit}</p>
                            <p>{m.totalWasted} {m.unit}</p>
                            <p>{m.currentStock} {m.unit}</p>
                            <p>{formatINR(m.weightedAverageCost)}</p>
                        </div>
                    ))}
                </div>
            )}

            {vendors.length > 0 && (
                <div className="list-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1fr' }}><b>Vendors Supplying This Project</b><b>Total Purchased</b></div>
                    {vendors.map(v => (
                        <div key={v.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr' }}>
                            <p>{v.vendorName}</p>
                            <p>{formatINR(v.totalPurchased)}</p>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ textAlign: 'right' }}>
                <span className="cursor edit-action" onClick={onViewWorks}>View all Works →</span>
            </div>
        </div>
    );
};

const TABS = [
    { key: 'overview',     label: 'Overview' },
    { key: 'works',        label: 'Works' },
    { key: 'measurements', label: 'Measurements' },
    { key: 'materials',    label: 'Materials' },
    { key: 'contractors',  label: 'Contractors' },
    { key: 'supervisors',  label: 'Supervisors' },
    { key: 'dailyLabour',  label: 'Daily Labour' },
    { key: 'runningBills', label: 'Running Bills' },
    { key: 'receipts',     label: 'Receipts' },
    { key: 'expenses',     label: 'Expenses' },
    { key: 'documents',    label: 'Documents' },
    { key: 'photos',       label: 'Photos' },
    { key: 'timeline',     label: 'Timeline' },
    { key: 'profitability', label: 'Profitability' },
];

const CONTRACT_TYPE_LABEL = { with_material: 'With Material', without_material: 'Without Material', advance: 'Advance' };
const STATUS_LABEL = { draft: 'Draft', active: 'Active', completed: 'Completed' };

const ProjectDetail = ({ url }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [activeTab, setActiveTab] = useState('overview');
    const [labourEntryMode, setLabourEntryMode] = useState('single');
    const [labourListRefreshKey, setLabourListRefreshKey] = useState(0);
    const [project, setProject] = useState(null);
    const [contractors, setContractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(false);

    // Progress % is never stored — computed here from the same works list
    // WorksManager fetches, just so it's visible without switching tabs.
    const [progressPct, setProgressPct] = useState(null);

    const fetchProject = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/projects/${id}`, authHeader);
            if (res.data.success) {
                setProject(res.data.data.project);
                setContractors(res.data.data.contractors || []);
            } else toast.error(res.data.message);
        } catch { toast.error('Error fetching project'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchProject(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId: id } })
            .then(res => {
                if (!res.data.success) return;
                const works = res.data.data;
                const estimated = works.reduce((sum, w) => sum + (w.estimatedAreaSqft || 0), 0);
                const completed = works.reduce((sum, w) => sum + (w.completedAreaSqft || 0), 0);
                setProgressPct(estimated > 0 ? Math.round((completed / estimated) * 100) : null);
            })
            .catch(() => {});
    }, [url, id, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    const activate = async () => {
        setActivating(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/activate`, { _id: id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchProject(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error activating project'); }
        finally { setActivating(false); }
    };

    if (loading) {
        return <div className="list add flex-col"><div className="admin-list-container"><div className="admin-empty-state"><p>Loading…</p></div></div></div>;
    }
    if (!project) {
        return <div className="list add flex-col"><div className="admin-list-container"><div className="admin-empty-state"><p>Project not found.</p></div></div></div>;
    }

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <button type="button" className="admin-search-clear" style={{ position: 'static', fontSize: '0.8rem', color: 'var(--text-lt)', marginBottom: '8px' }} onClick={() => navigate('/finance/projects')}>← All Projects</button>
                        <h1>{project.name}</h1>
                        <p className="admin-subtitle">
                            {project.clientId?.name || 'No client'} · <span className="item-category">{CONTRACT_TYPE_LABEL[project.contractType]}</span> · <span className="item-category">{STATUS_LABEL[project.status]}</span>
                            {progressPct != null && <> · <span className="item-category">{progressPct}% complete</span></>}
                        </p>
                    </div>
                    {project.status === 'draft' && (
                        <button type="button" className="add-point-btn" disabled={activating} onClick={activate}>
                            {activating ? 'Activating…' : 'Activate Project'}
                        </button>
                    )}
                </div>

                <div className="admin-category-scroll">
                    {TABS.map(t => (
                        <button key={t.key} className={`admin-cat-pill${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'overview' && (
                    <div>
                        <div className="list-table" style={{ marginBottom: '24px' }}>
                            <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Site Location</b></p><p>{project.siteLocation || '—'}</p></div>
                            <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Start Date</b></p><p>{project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}</p></div>
                            <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Estimated Area</b></p><p>{project.estimatedAreaSqft || 0} sqft</p></div>
                            <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Material Tracking</b></p><p>{project.materialTrackingEnabled ? 'Enabled' : 'Disabled'}</p></div>
                            {project.contractType === 'advance' && (
                                <>
                                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Total Estimated Cost</b></p><p>₹{project.totalEstimatedCost?.toLocaleString('en-IN')}</p></div>
                                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Contract Percentage</b></p><p>{project.contractPercentage}%</p></div>
                                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Advance Amount</b></p><p>₹{project.advanceAmount?.toLocaleString('en-IN')}</p></div>
                                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Advance Received</b></p><p>{project.advanceReceived ? `Yes — ${new Date(project.advanceReceivedAt).toLocaleDateString()}` : 'Not yet'}</p></div>
                                </>
                            )}
                            <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Notes</b></p><p>{project.notes || '—'}</p></div>
                        </div>
                        <ProjectOverviewTab url={url} projectId={id} contractType={project.contractType} onViewWorks={() => setActiveTab('works')} />
                    </div>
                )}

                {activeTab === 'works' && (
                    <div>
                        <WorksManager url={url} projectId={id} />
                        <h3 style={{ margin: '32px 0 8px' }}>Work Type Rates</h3>
                        <WorkTypeRatesManager url={url} projectId={id} />
                        <h3 style={{ margin: '28px 0 8px' }}>Team Rates</h3>
                        <TeamRatesManager url={url} projectId={id} />
                    </div>
                )}

                {activeTab === 'measurements' && <MeasurementsManager url={url} projectId={id} />}

                {activeTab === 'materials' && <StockMovementsManager url={url} projectId={id} />}

                {activeTab === 'contractors' && (
                    <div className="list-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr' }}><b>Contractor</b><b>Work Types</b></div>
                        {contractors.length === 0 ? (
                            <div className="admin-empty-state"><p>No contractor assigned to any Work yet — add a Work and pick a team under the Works tab.</p></div>
                        ) : contractors.map(c => (
                            <div key={c.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <p>{c.vendorName}</p>
                                <p>{c.workTypes.join(', ')}</p>
                            </div>
                        ))}
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Referral Vendor</b></p><p>{project.referralVendorId?.name || '—'}</p></div>
                    </div>
                )}

                {activeTab === 'supervisors' && (
                    <div className="list-table">
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <p><b>Assigned Supervisor</b></p>
                            <p>{project.assignedSupervisorId?.name || project.assignedSupervisor || '—'}</p>
                        </div>
                    </div>
                )}

                {activeTab === 'dailyLabour' && (
                    <div>
                        <div className="wizard-actions" style={{ marginBottom: '16px', justifyContent: 'flex-start', gap: '8px' }}>
                            <button type="button" className={`add-btn ${labourEntryMode === 'single' ? '' : 'cancel-btn'}`} onClick={() => setLabourEntryMode('single')}>Single Entry</button>
                            <button type="button" className={`add-btn ${labourEntryMode === 'batch' ? '' : 'cancel-btn'}`} onClick={() => setLabourEntryMode('batch')}>Batch Grid Entry</button>
                        </div>
                        {labourEntryMode === 'single' ? (
                            <DailyLabourManager url={url} projectId={id} />
                        ) : (
                            <>
                                <DailyLabourBatchEntry url={url} projectId={id} onSubmitted={() => setLabourListRefreshKey(k => k + 1)} />
                                <div style={{ marginTop: '24px' }}>
                                    <DailyLabourManager key={labourListRefreshKey} url={url} projectId={id} readOnly />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'runningBills' && (
                    project.contractType === 'advance'
                        ? <PlaceholderTab text="Advance-contract projects don't use Running Bills — see the advance payment fields on the Overview tab instead." />
                        : <RunningBillsManager url={url} projectId={id} />
                )}
                {activeTab === 'receipts' && <ReceiptsManager url={url} projectId={id} />}
                {activeTab === 'expenses' && <PlaceholderTab text="Site expenses logged against this project." />}
                {activeTab === 'documents' && <PlaceholderTab text="Documents on file for this project." />}
                {activeTab === 'photos' && <PlaceholderTab text="Site photos for this project." />}
                {activeTab === 'timeline' && <PlaceholderTab text="Chronological activity log for this project." />}
                {activeTab === 'profitability' && <PlaceholderTab text="Lifetime billing, cost, and profit summary for this project." phase="Phase 2" />}
            </div>
        </div>
    );
};

export default ProjectDetail;
