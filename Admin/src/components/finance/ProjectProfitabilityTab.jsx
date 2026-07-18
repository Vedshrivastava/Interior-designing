import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import { KpiCard, KpiGrid, formatINR } from './DashboardWidgets';
import '../../styles/list.css';

const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material', 'advance'];

/*
 * Lifetime billing/cost/profit summary — deliberately non-duplicative of
 * ProjectOverviewTab (which already owns the cost-breakdown donut and
 * progress-over-time chart): this tab is tables-and-KPIs, going deeper
 * into the Approved-vs-Total split (via the WorkDetail.jsx "Total logged"
 * sub-line pattern) and per-contractor/per-labourer earnings that Overview
 * never surfaces. Always all-time, no scope selector — computeProjectProfit
 * has no date scoping to begin with (revenue/profit come from issued
 * running bills, which aren't measurement-dated), same reasoning
 * WorkDetail.jsx documents for why its own scope picker never touches
 * Revenue/Profit either.
 */
const ProjectProfitabilityTab = ({ url, projectId, contractType }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [profit, setProfit] = useState(null);
    const [receivable, setReceivable] = useState(null);
    const [contractors, setContractors] = useState([]);
    const [labourers, setLabourers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const requests = [
                axios.get(`${url}/api/finance/reports/project-profit`, { ...authHeader, params: { projectId } }),
                axios.get(`${url}/api/finance/reports/contractor-analysis`, { ...authHeader, params: { projectId } }),
                axios.get(`${url}/api/finance/reports/labour-analysis`, { ...authHeader, params: { projectId } }),
            ];
            if (BILLABLE_CONTRACT_TYPES.includes(contractType)) {
                requests.push(axios.get(`${url}/api/finance/receivables/summary`, { ...authHeader, params: { projectId } }));
            }
            const [profitRes, contractorRes, labourRes, receivableRes] = await Promise.all(requests);
            if (profitRes.data.success) setProfit(profitRes.data.data);
            if (contractorRes.data.success) setContractors(contractorRes.data.data.filter(r => r.totalAmount > 0));
            if (labourRes.data.success) setLabourers(labourRes.data.data.filter(r => r.totalAmount > 0));
            if (receivableRes?.data.success) setReceivable(receivableRes.data.data);
        } catch { toast.error('Error fetching profitability data'); }
        finally { setLoading(false); }
    }, [url, projectId, contractType]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchAll(); }, [fetchAll]);
    useFinanceWsRefresh(['*'], fetchAll);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!profit) return <div className="admin-empty-state"><p>No profitability data yet for this project.</p></div>;

    return (
        <div>
            <KpiGrid>
                <KpiCard label="Revenue" value={formatINR(profit.revenue)} sub="All-time, from issued bills" />
                <KpiCard label="Profit" value={formatINR(profit.profit)} tone={profit.profit >= 0 ? 'good' : 'danger'} />
                <KpiCard label="Margin %" value={`${profit.marginPercent.toFixed(1)}%`} tone={profit.marginPercent >= 0 ? 'good' : 'danger'} />
                <KpiCard label="Material Cost" value={formatINR(profit.materialCost)} />
                <KpiCard
                    label="Contractor Cost (Approved)"
                    value={profit.contractorCost > 0 ? formatINR(profit.contractorCost) : (profit.totalContractorCost > 0 ? 'Unapproved' : formatINR(0))}
                    tone={profit.contractorCost > 0 ? 'good' : (profit.totalContractorCost > 0 ? 'danger' : undefined)}
                    sub={profit.totalContractorCost > profit.contractorCost ? `Total logged: ${formatINR(profit.totalContractorCost)}` : 'All-time'}
                />
                <KpiCard
                    label="Labour Cost (Approved)"
                    value={profit.labourCost > 0 ? formatINR(profit.labourCost) : (profit.totalLabourCost > 0 ? 'Unapproved' : formatINR(0))}
                    tone={profit.labourCost > 0 ? 'good' : (profit.totalLabourCost > 0 ? 'danger' : undefined)}
                    sub={profit.totalLabourCost > profit.labourCost ? `Total logged: ${formatINR(profit.totalLabourCost)}` : 'All-time'}
                />
                <KpiCard label="Commission Cost" value={formatINR(profit.commissionCost)} />
                <KpiCard label="Other Expenses" value={formatINR(profit.otherExpenses)} />
            </KpiGrid>

            {receivable && (
                <div className="list-table" style={{ marginTop: '24px', marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr' }}><b>Receivables</b></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1.3fr' }}>
                        <p>Billed: {formatINR(receivable.issuedTotal)}</p>
                        <p>Received: {formatINR(receivable.receivedTotal)}</p>
                        <p style={{ color: receivable.balance > 0 ? '#c0392b' : 'var(--moss)' }}>Outstanding: {formatINR(receivable.balance)}</p>
                        <p>{receivable.issuedBillCount} bill{receivable.issuedBillCount === 1 ? '' : 's'} issued</p>
                        <p>{receivable.oldestIssuedBillDate ? `Oldest: ${new Date(receivable.oldestIssuedBillDate).toLocaleDateString()}` : '—'}</p>
                    </div>
                </div>
            )}

            {contractors.length === 0 ? (
                <div className="admin-empty-state"><p>No contractor has logged work on this project yet.</p></div>
            ) : (
                <div className="list-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                        <b>Contractor</b><b>Total Logged</b><b>Approved Earnings</b><b>Advances</b><b>Deductions</b><b>Payments</b><b>Balance Payable</b>
                    </div>
                    {contractors.map(c => (
                        <div key={c.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                            <p>{c.vendorName}</p>
                            <p>{formatINR(c.totalAmount)}</p>
                            <p>{formatINR(c.earnings)}</p>
                            <p>{formatINR(c.advances)}</p>
                            <p>{formatINR(c.deductions)}</p>
                            <p>{formatINR(c.payments)}</p>
                            <p style={{ color: c.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>{formatINR(c.balancePayable)}</p>
                        </div>
                    ))}
                </div>
            )}

            {labourers.length === 0 ? (
                <div className="admin-empty-state"><p>No labourer has logged work on this project yet.</p></div>
            ) : (
                <div className="list-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                        <b>Labourer</b><b>Total Logged</b><b>Approved Earnings</b><b>Advances</b><b>Deductions</b><b>Payments</b><b>Balance Payable</b>
                    </div>
                    {labourers.map(l => (
                        <div key={l.labourerId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                            <p>{l.labourerName}</p>
                            <p>{formatINR(l.totalAmount)}</p>
                            <p>{formatINR(l.earnings)}</p>
                            <p>{formatINR(l.advances)}</p>
                            <p>{formatINR(l.deductions)}</p>
                            <p>{formatINR(l.payments)}</p>
                            <p style={{ color: l.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>{formatINR(l.balancePayable)}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProjectProfitabilityTab;
