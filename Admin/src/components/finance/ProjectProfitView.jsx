import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import StyledSelect from './StyledSelect';
import { KpiCard, KpiGrid } from './DashboardWidgets';
import '../../styles/list.css';

// Same dashboardCache idea as FinanceHome.jsx, keyed by projectId — this
// view only ever fetches once a project's picked, so there's no "all
// projects" bucket to seed, just one cache entry per project visited.
const projectProfitCache = new Map(); // projectId -> { data, works }

/* Project picker + the full Revenue/Cost/Profit breakdown for one project,
   plus a Works list underneath purely so "View Work Profit" links have
   something to drill into — Project Profit itself only returns project-
   level totals, not a per-work split. */
const ProjectProfitView = ({ url, projectId, onSelectProject, onViewClientProfit, onViewWorkProfit }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const cached = projectProfitCache.get(projectId);
    const [data, setData] = useState(cached?.data || null);
    const [works, setWorks] = useState(cached?.works || []);
    const [loading, setLoading] = useState(!!projectId && !cached);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchData = () => {
        Promise.all([
            axios.get(`${url}/api/finance/reports/project-profit`, { ...authHeader, params: { projectId } }),
            axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId } }),
        ]).then(([profitRes, worksRes]) => {
            const nextData = profitRes.data.success ? profitRes.data.data : null;
            const nextWorks = worksRes.data.success ? worksRes.data.data : [];
            if (profitRes.data.success) setData(nextData);
            if (worksRes.data.success) setWorks(nextWorks);
            if (profitRes.data.success && worksRes.data.success) projectProfitCache.set(projectId, { data: nextData, works: nextWorks });
        }).catch(() => toast.error('Error fetching project profit'))
          .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!projectId) { setData(null); setWorks([]); return; }
        const existing = projectProfitCache.get(projectId);
        if (existing) { setData(existing.data); setWorks(existing.works); setLoading(false); }
        else setLoading(true);
        fetchData();
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Project profit rolls up nearly every cost/revenue domain (bills,
    // materials, contractor labour, commission, other expenses) — rather
    // than a brittle allow-list, any finance broadcast triggers a silent
    // refetch while a project is selected.
    useFinanceWsRefresh(['*'], () => { if (projectId) fetchData(); });

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project</p>
                <StyledSelect value={projectId} onChange={onSelectProject} placeholder="Select project…" options={projects.map(p => ({ value: p._id, label: p.name }))} />
            </div>

            {loading && <div className="admin-empty-state"><p>Loading…</p></div>}

            {!loading && !projectId && <div className="admin-empty-state"><p>Select a project to view its profit breakdown.</p></div>}

            {!loading && data && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                        <button type="button" className="add-point-btn" onClick={() => onViewClientProfit(data.clientId)}>View Client Profit →</button>
                    </div>

                    <KpiGrid>
                        <KpiCard label="Revenue" value={`₹${data.revenue.toLocaleString('en-IN')}`} />
                        <KpiCard label="Material Cost" value={`₹${data.materialCost.toLocaleString('en-IN')}`} sub="Weighted avg" />
                        <KpiCard
                            label="Contractor Cost"
                            value={data.contractorCost > 0 ? `₹${data.contractorCost.toLocaleString('en-IN')}` : (data.totalContractorCost > 0 ? 'Unapproved' : '₹0')}
                            tone={data.contractorCost === 0 && data.totalContractorCost > 0 ? 'danger' : undefined}
                            sub={data.totalContractorCost > data.contractorCost ? `Total logged: ₹${data.totalContractorCost.toLocaleString('en-IN')}` : undefined}
                        />
                        <KpiCard label="Commission Cost" value={`₹${data.commissionCost.toLocaleString('en-IN')}`} />
                        <KpiCard
                            label="Labour Cost"
                            value={data.labourCost > 0 ? `₹${data.labourCost.toLocaleString('en-IN')}` : (data.totalLabourCost > 0 ? 'Unapproved' : '₹0')}
                            tone={data.labourCost === 0 && data.totalLabourCost > 0 ? 'danger' : undefined}
                            sub={data.totalLabourCost > data.labourCost ? `Total logged: ₹${data.totalLabourCost.toLocaleString('en-IN')}` : undefined}
                        />
                        <KpiCard label="Other Expenses" value={`₹${data.otherExpenses.toLocaleString('en-IN')}`} />
                        <KpiCard label="Material Waste Cost" value={`₹${data.materialWasteCost.toLocaleString('en-IN')}`} tone={data.materialWasteCost > 0 ? 'danger' : undefined} />
                        <KpiCard label="Profit" value={`₹${data.profit.toLocaleString('en-IN')} (${data.marginPercent.toFixed(1)}%)`} tone={data.profit >= 0 ? 'good' : 'danger'} />
                    </KpiGrid>

                    {(data.unapprovedAreaSqft > 0 || data.unapprovedCommissionCost > 0) && (
                        <>
                            <p className="admin-subtitle" style={{ margin: '24px 0 10px' }}>Unapproved (Pending Review)</p>
                            <KpiGrid>
                                <KpiCard label="Area" value={`${data.unapprovedAreaSqft.toLocaleString('en-IN')} sqft`} />
                                <KpiCard label="Contractor Unapproved" value={`₹${data.unapprovedContractorCost.toLocaleString('en-IN')}`} />
                                <KpiCard label="Labour Unapproved" value={`₹${data.unapprovedLabourCost.toLocaleString('en-IN')}`} />
                                <KpiCard label="Commission" value={`₹${data.unapprovedCommissionCost.toLocaleString('en-IN')}`} />
                                <KpiCard label="Revenue" value={`₹${data.unapprovedRevenue.toLocaleString('en-IN')}`} />
                                <KpiCard label="Profit" value={`₹${data.unapprovedProfit.toLocaleString('en-IN')}`} tone={data.unapprovedProfit >= 0 ? 'good' : 'danger'} />
                            </KpiGrid>
                            <p className="admin-subtitle" style={{ margin: '10px 0 4px' }}>
                                Logged work whose cost isn't counted in Profit yet.
                            </p>
                            <p className="admin-subtitle" style={{ marginBottom: '24px', fontWeight: 600, color: data.totalProjectedProfit >= 0 ? 'var(--moss)' : '#c0392b' }}>
                                Total Projected Profit (Approved + Unapproved): ₹{data.totalProjectedProfit.toLocaleString('en-IN')}
                            </p>
                        </>
                    )}

                    {(data.directPaymentContractorTotal > 0 || data.directPaymentLabourTotal > 0) && (
                        <>
                            <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Direct Payments (Client → Workers)</p>
                            <div className="dash-chart-card rpp-dp-card" style={{ marginBottom: '8px' }}>
                                <div className="rpp-dp-row rpp-dp-header">
                                    <b className="rpp-dp-party">Party</b>
                                    <b className="rpp-dp-total">Total</b>
                                </div>
                                {data.directPaymentContractorTotal > 0 && (
                                    <div className="rpp-dp-row">
                                        <p className="rpp-dp-party">Contractor</p>
                                        <p className="rpp-dp-total">₹{data.directPaymentContractorTotal.toLocaleString('en-IN')}</p>
                                    </div>
                                )}
                                {data.directPaymentLabourTotal > 0 && (
                                    <div className="rpp-dp-row">
                                        <p className="rpp-dp-party">Labour</p>
                                        <p className="rpp-dp-total">₹{data.directPaymentLabourTotal.toLocaleString('en-IN')}</p>
                                    </div>
                                )}
                            </div>
                            <p className="admin-subtitle" style={{ marginBottom: '24px' }}>
                                Amounts the client paid directly to a worker on this project — an advance, not tied to specific sqft, so it's a flat reduction against that worker's overall Balance Payable, not netted against Unapproved/Approved above.
                            </p>
                        </>
                    )}

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Works: drill into a work's own profit</p>
                    <div className="dash-chart-card rpp-work-card">
                        <div className="rpp-work-row rpp-work-header">
                            <b className="rpp-work-type">Work Type</b>
                            <b className="rpp-work-area">Completed / Estimated</b>
                            <b className="rpp-work-status">Status</b>
                            <b className="rpp-work-action">Action</b>
                        </div>
                        {works.length === 0 ? (
                            <div className="admin-empty-state"><p>No works yet for this project.</p></div>
                        ) : works.map(w => (
                            <div key={w._id} className="rpp-work-row">
                                <p className="rpp-work-type">{w.workType}</p>
                                <p className="rpp-work-area"><span className="pq-group-label">Completed / Estimated</span>{w.completedAreaSqft} / {w.estimatedAreaSqft} sqft</p>
                                <p className="rpp-work-status"><span className="item-category">{w.status}</span></p>
                                <div className="rpp-work-action">
                                    <p className="cursor edit-action" onClick={() => onViewWorkProfit(w._id)}>View Profit</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ProjectProfitView;
