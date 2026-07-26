import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import StyledSelect from './StyledSelect';
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

                    <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            <b>Revenue</b><b>Material Cost <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-lt)' }}>(weighted avg)</span></b><b>Contractor Cost</b><b>Commission Cost</b>
                        </div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            <p>₹{data.revenue.toLocaleString('en-IN')}</p>
                            <p>₹{data.materialCost.toLocaleString('en-IN')}</p>
                            <p>
                                {data.contractorCost > 0 ? `₹${data.contractorCost.toLocaleString('en-IN')}` : (data.totalContractorCost > 0 ? <span style={{ color: '#c0392b' }}>Unapproved</span> : '₹0')}
                                {data.totalContractorCost > data.contractorCost && (
                                    <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-lt)' }}>Total logged: ₹{data.totalContractorCost.toLocaleString('en-IN')}</span>
                                )}
                            </p>
                            <p>₹{data.commissionCost.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            <b>Labour Cost</b><b>Other Expenses</b><b>Material Waste Cost</b><b>Profit</b>
                        </div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            <p>
                                {data.labourCost > 0 ? `₹${data.labourCost.toLocaleString('en-IN')}` : (data.totalLabourCost > 0 ? <span style={{ color: '#c0392b' }}>Unapproved</span> : '₹0')}
                                {data.totalLabourCost > data.labourCost && (
                                    <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-lt)' }}>Total logged: ₹{data.totalLabourCost.toLocaleString('en-IN')}</span>
                                )}
                            </p>
                            <p>₹{data.otherExpenses.toLocaleString('en-IN')}</p>
                            <p style={{ color: data.materialWasteCost > 0 ? '#c0392b' : 'inherit' }}>₹{data.materialWasteCost.toLocaleString('en-IN')}</p>
                            <p style={{ fontWeight: 700, color: data.profit >= 0 ? 'var(--moss)' : '#c0392b' }}>
                                ₹{data.profit.toLocaleString('en-IN')} ({data.marginPercent.toFixed(1)}%)
                            </p>
                        </div>
                    </div>

                    {(data.unapprovedAreaSqft > 0 || data.unapprovedCommissionCost > 0) && (
                        <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                            <div className="list-table-format title" style={{ gridTemplateColumns: '1fr' }}><b>Unapproved (Pending Review)</b></div>
                            <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }}>
                                <b>Area</b><b>Contractor Unapproved</b><b>Labour Unapproved</b><b>Commission</b><b>Revenue</b><b>Profit</b>
                            </div>
                            <div className="list-table-format row-item unapproved-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }}>
                                <p>{data.unapprovedAreaSqft.toLocaleString('en-IN')} sqft</p>
                                <p>₹{data.unapprovedContractorCost.toLocaleString('en-IN')}</p>
                                <p>₹{data.unapprovedLabourCost.toLocaleString('en-IN')}</p>
                                <p>₹{data.unapprovedCommissionCost.toLocaleString('en-IN')}</p>
                                <p>₹{data.unapprovedRevenue.toLocaleString('en-IN')}</p>
                                <p style={{ color: data.unapprovedProfit >= 0 ? 'var(--moss)' : '#c0392b' }}>₹{data.unapprovedProfit.toLocaleString('en-IN')}</p>
                            </div>
                            <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                                Logged work whose cost isn't counted in Profit yet.
                            </p>
                            <p className="admin-subtitle" style={{ padding: '0 20px 16px', fontWeight: 600, color: data.totalProjectedProfit >= 0 ? 'var(--moss)' : '#c0392b' }}>
                                Total Projected Profit (Approved + Unapproved): ₹{data.totalProjectedProfit.toLocaleString('en-IN')}
                            </p>
                        </div>
                    )}

                    {(data.directPaymentContractorTotal > 0 || data.directPaymentLabourTotal > 0) && (
                        <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                            <div className="list-table-format title" style={{ gridTemplateColumns: '1fr' }}><b>Direct Payments (Client → Workers)</b></div>
                            <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <b>Party</b><b>Total</b>
                            </div>
                            {data.directPaymentContractorTotal > 0 && (
                                <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                    <p>Contractor</p>
                                    <p>₹{data.directPaymentContractorTotal.toLocaleString('en-IN')}</p>
                                </div>
                            )}
                            {data.directPaymentLabourTotal > 0 && (
                                <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                    <p>Labour</p>
                                    <p>₹{data.directPaymentLabourTotal.toLocaleString('en-IN')}</p>
                                </div>
                            )}
                            <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                                Amounts the client paid directly to a worker on this project — an advance, not tied to specific sqft, so it's a flat reduction against that worker's overall Balance Payable, not netted against Unapproved/Approved above.
                            </p>
                        </div>
                    )}

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Works: drill into a work's own profit</p>
                    <div className="list-table finance-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 140px' }}>
                            <b>Work Type</b><b>Completed / Estimated</b><b>Status</b><b>Action</b>
                        </div>
                        {works.length === 0 ? (
                            <div className="admin-empty-state"><p>No works yet for this project.</p></div>
                        ) : works.map(w => (
                            <div key={w._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 140px' }}>
                                <p>{w.workType}</p>
                                <p>{w.completedAreaSqft} / {w.estimatedAreaSqft} sqft</p>
                                <p><span className="item-category">{w.status}</span></p>
                                <p className="cursor edit-action" onClick={() => onViewWorkProfit(w._id)}>View Profit</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ProjectProfitView;
