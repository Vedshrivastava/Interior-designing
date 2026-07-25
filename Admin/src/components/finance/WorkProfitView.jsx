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
            <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <b>Revenue</b><b>Contractor Cost</b><b>Labour Cost</b>
                </div>
                <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <p>₹{data.revenue.toLocaleString('en-IN')}</p>
                    <p>
                        {data.contractorCost > 0 ? `₹${data.contractorCost.toLocaleString('en-IN')}` : (data.totalAmount > 0 ? <span style={{ color: '#c0392b' }}>Unapproved</span> : '₹0')}
                        {data.totalAmount > data.contractorCost && (
                            <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-lt)' }}>Total logged: ₹{data.totalAmount.toLocaleString('en-IN')}</span>
                        )}
                    </p>
                    <p>₹{data.labourCost.toLocaleString('en-IN')}</p>
                </div>
                <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <b>Material Cost <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-lt)' }}>(weighted avg)</span></b><b>Commission Cost</b><b>Profit</b>
                </div>
                <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <p>₹{data.materialCost.toLocaleString('en-IN')}</p>
                    <p>₹{data.commissionCost.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 700, color: data.profit >= 0 ? 'var(--moss)' : '#c0392b' }}>₹{data.profit.toLocaleString('en-IN')}</p>
                </div>
            </div>

            {(data.unapprovedAreaSqft > 0 || data.unapprovedCommissionAmount > 0) && (
                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr' }}><b>Unapproved (Pending Review)</b></div>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }}>
                        <b>Area</b><b>Contractor Payment Left</b><b>Labour Payment Left</b><b>Commission</b><b>Revenue</b><b>Profit</b>
                    </div>
                    <div className="list-table-format row-item unapproved-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }}>
                        <p>{data.unapprovedAreaSqft.toLocaleString('en-IN')} sqft</p>
                        <p>₹{data.contractorPaymentLeftUnapproved.toLocaleString('en-IN')}</p>
                        <p>₹{data.labourPaymentLeftUnapproved.toLocaleString('en-IN')}</p>
                        <p>₹{data.unapprovedCommissionAmount.toLocaleString('en-IN')}</p>
                        <p>₹{data.unapprovedRevenue.toLocaleString('en-IN')}</p>
                        <p style={{ color: data.unapprovedProfit >= 0 ? 'var(--moss)' : '#c0392b' }}>₹{data.unapprovedProfit.toLocaleString('en-IN')}</p>
                    </div>
                    <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                        Logged work on this Work whose cost isn't counted in Profit yet — Contractor/Labour Payment Left is already net of client direct payments recorded against this Work.
                    </p>
                </div>
            )}

            {(data.contractorDirectPaymentUnapproved > 0 || data.labourDirectPaymentUnapproved > 0 || data.contractorDirectPaymentApproved > 0 || data.labourDirectPaymentApproved > 0) && (
                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr' }}><b>Direct Payments (Client → Workers)</b></div>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <b>Party</b><b>Applied to Unapproved</b><b>Applied to Approved</b>
                    </div>
                    {data.contractorDirectPaymentUnapproved + data.contractorDirectPaymentApproved > 0 && (
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                            <p>Contractor</p>
                            <p>₹{data.contractorDirectPaymentUnapproved.toLocaleString('en-IN')}</p>
                            <p>₹{data.contractorDirectPaymentApproved.toLocaleString('en-IN')}</p>
                        </div>
                    )}
                    {data.labourDirectPaymentUnapproved + data.labourDirectPaymentApproved > 0 && (
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                            <p>Labour</p>
                            <p>₹{data.labourDirectPaymentUnapproved.toLocaleString('en-IN')}</p>
                            <p>₹{data.labourDirectPaymentApproved.toLocaleString('en-IN')}</p>
                        </div>
                    )}
                    <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                        Amounts the client paid directly to a worker on this Work, applied to Unapproved first and only spilling into Approved once Unapproved is fully covered.
                    </p>
                </div>
            )}

            {data.contractorBreakdown.length > 0 && (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Contractor breakdown</p>
                    <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                            <b>Contractor</b><b>Area</b><b>Rate</b><b>Amount</b>
                        </div>
                        {data.contractorBreakdown.map(r => (
                            <div key={r.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                                <p>{r.vendorName}</p>
                                <p>{r.areaSqft.toLocaleString('en-IN')} sqft</p>
                                <p>₹{r.rate}/sqft</p>
                                <p>₹{r.approvedAmount.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {data.labourBreakdown.length > 0 && (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Labour breakdown</p>
                    <div className="list-table finance-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                            <b>Labourer</b><b>Area</b><b>Rate</b><b>Amount</b>
                        </div>
                        {data.labourBreakdown.map(r => (
                            <div key={r.labourerId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                                <p>{r.labourerName}</p>
                                <p>{r.areaSqft.toLocaleString('en-IN')} sqft</p>
                                <p>₹{r.rate}/sqft</p>
                                <p>₹{r.approvedAmount.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default WorkProfitView;
