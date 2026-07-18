import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';

// Same dashboardCache idea as FinanceHome.jsx, keyed by workId.
const workProfitCache = new Map();

/* No standalone picker here by design — reached by drilling in from a
   project's Works tab (WorksManager's "View Profit" link) or from Project
   Profit's own Works list, both of which pass a workId in. */
const WorkProfitView = ({ url, workId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [data, setData] = useState(workProfitCache.get(workId) || null);
    const [loading, setLoading] = useState(!!workId && !workProfitCache.has(workId));

    const fetchData = () => {
        axios.get(`${url}/api/finance/reports/work-profit`, { ...authHeader, params: { workId } })
            .then(res => { if (res.data.success) { setData(res.data.data); workProfitCache.set(workId, res.data.data); } })
            .catch(() => toast.error('Error fetching work profit'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!workId) { setData(null); return; }
        const existing = workProfitCache.get(workId);
        if (existing) { setData(existing); setLoading(false); }
        else setLoading(true);
        fetchData();
    }, [url, workId]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh([
        'financeWorksChanged', 'financeRunningBillsChanged', 'financeMeasurementsChanged',
        'financeWorkContractorAssignmentsChanged', 'financeContractorRatesChanged',
        'financeLabourMeasurementsChanged', 'financeLabourRatesChanged', 'financeWorkTypeRatesChanged',
    ], () => { if (workId) fetchData(); });

    if (!workId) {
        return <div className="admin-empty-state"><p>Open a project's Works tab and click "View Profit" on a work to see it here.</p></div>;
    }
    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!data) return <div className="admin-empty-state"><p>Work not found.</p></div>;

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                {data.workType} · {data.completedAreaSqft} / {data.estimatedAreaSqft} sqft completed, {data.areaBilledSqft} sqft billed
            </p>
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <b>Revenue</b><b>Contractor Cost</b><b>Material Cost <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-lt)' }}>(weighted avg)</span></b><b>Profit</b>
                </div>
                <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <p>₹{data.revenue.toLocaleString('en-IN')}</p>
                    <p>
                        {data.contractorCost > 0 ? `₹${data.contractorCost.toLocaleString('en-IN')}` : (data.totalAmount > 0 ? <span style={{ color: '#c0392b' }}>Unapproved</span> : '₹0')}
                        {data.totalAmount > data.contractorCost && (
                            <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-lt)' }}>Total logged: ₹{data.totalAmount.toLocaleString('en-IN')}</span>
                        )}
                    </p>
                    <p>₹{data.materialCost.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 700, color: data.profit >= 0 ? 'var(--moss)' : '#c0392b' }}>₹{data.profit.toLocaleString('en-IN')}</p>
                </div>
            </div>
        </div>
    );
};

export default WorkProfitView;
