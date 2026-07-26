import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import { KpiCard, KpiGrid, KpiSectionLabel, formatINR } from './DashboardWidgets';
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
    // Same shape as ProjectOverviewTab's own Payables row — Vendor/
    // Contractor/Labour balances (approved + unapproved combined, clamped
    // at 0 per row before summing) plus Expense Payables, so this tab
    // doesn't leave "what's still owed" entirely to the Overview tab.
    const [payables, setPayables] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const requests = [
                axios.get(`${url}/api/finance/reports/project-profit`, { ...authHeader, params: { projectId } }),
                axios.get(`${url}/api/finance/reports/contractor-analysis`, { ...authHeader, params: { projectId } }),
                axios.get(`${url}/api/finance/reports/labour-analysis`, { ...authHeader, params: { projectId } }),
                axios.get(`${url}/api/finance/reports/vendor-analysis`, { ...authHeader, params: { projectId } }),
                axios.get(`${url}/api/finance/expenses/list`, { ...authHeader, params: { projectId } }),
            ];
            if (BILLABLE_CONTRACT_TYPES.includes(contractType)) {
                requests.push(axios.get(`${url}/api/finance/receivables/summary`, { ...authHeader, params: { projectId } }));
            }
            const [profitRes, contractorRes, labourRes, vendorRes, expenseRes, receivableRes] = await Promise.all(requests);
            if (profitRes.data.success) setProfit(profitRes.data.data);
            if (contractorRes.data.success) setContractors(contractorRes.data.data.filter(r => r.totalAmount > 0));
            if (labourRes.data.success) setLabourers(labourRes.data.data.filter(r => r.totalAmount > 0));
            if (receivableRes?.data.success) setReceivable(receivableRes.data.data);

            const sumPositive = (rows, key) => Math.round(rows.reduce((s, r) => s + Math.max(0, r[key]), 0) * 100) / 100;
            // See ProjectDetail.jsx's identical helper — the credit side of
            // the same balance, never netted against the payable figures.
            const sumNegative = (rows, key) => Math.round(rows.reduce((s, r) => s + Math.max(0, -r[key]), 0) * 100) / 100;
            setPayables({
                vendorPaymentLeft: vendorRes.data.success ? sumPositive(vendorRes.data.data, 'amountOwed') : 0,
                contractorBalancePayable: contractorRes.data.success ? sumPositive(contractorRes.data.data, 'balancePayable') : 0,
                labourBalancePayable: labourRes.data.success ? sumPositive(labourRes.data.data, 'balancePayable') : 0,
                expensePayable: expenseRes.data.success ? sumPositive(expenseRes.data.data, 'balance') : 0,
                vendorCredit: vendorRes.data.success ? sumNegative(vendorRes.data.data, 'amountOwed') : 0,
                contractorCredit: contractorRes.data.success ? sumNegative(contractorRes.data.data, 'balancePayable') : 0,
                labourCredit: labourRes.data.success ? sumNegative(labourRes.data.data, 'balancePayable') : 0,
            });
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
                <KpiCard label="Material Waste Cost" value={formatINR(profit.materialWasteCost)} tone={profit.materialWasteCost > 0 ? 'danger' : undefined} />
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
                <KpiCard
                    label="Commission Cost (Approved)"
                    value={profit.commissionCost > 0 ? formatINR(profit.commissionCost) : (profit.totalCommissionCost > 0 ? 'Unapproved' : formatINR(0))}
                    tone={profit.commissionCost > 0 ? 'good' : (profit.totalCommissionCost > 0 ? 'danger' : undefined)}
                    sub={profit.totalCommissionCost > profit.commissionCost ? `Total logged: ${formatINR(profit.totalCommissionCost)}` : 'All-time'}
                />
                <KpiCard label="Other Expenses" value={formatINR(profit.otherExpenses)} />
            </KpiGrid>

            {payables && (payables.vendorPaymentLeft > 0 || payables.contractorBalancePayable > 0 || payables.labourBalancePayable > 0 || payables.expensePayable > 0) && (
                <>
                    <KpiSectionLabel>Payables — Everything This Project Still Owes, Right Now</KpiSectionLabel>
                    <KpiGrid>
                        <KpiCard label="Vendor Payment Left" value={formatINR(payables.vendorPaymentLeft)} tone={payables.vendorPaymentLeft > 0 ? 'danger' : 'good'} />
                        <KpiCard label="Contractor Balance Payable" value={formatINR(payables.contractorBalancePayable)} tone={payables.contractorBalancePayable > 0 ? 'danger' : 'good'} />
                        <KpiCard label="Labour Balance Payable" value={formatINR(payables.labourBalancePayable)} tone={payables.labourBalancePayable > 0 ? 'danger' : 'good'} />
                        <KpiCard label="Expense Payables" value={formatINR(payables.expensePayable)} tone={payables.expensePayable > 0 ? 'danger' : 'good'} />
                    </KpiGrid>
                </>
            )}

            {payables && (payables.vendorCredit > 0 || payables.contractorCredit > 0 || payables.labourCredit > 0) && (
                <>
                    <KpiSectionLabel>Credit — These Parties Owe The Company Back</KpiSectionLabel>
                    <KpiGrid>
                        {payables.vendorCredit > 0 && <KpiCard label="Vendor Owes Us" value={formatINR(payables.vendorCredit)} tone="good" />}
                        {payables.contractorCredit > 0 && <KpiCard label="Contractor Owes Us" value={formatINR(payables.contractorCredit)} tone="good" />}
                        {payables.labourCredit > 0 && <KpiCard label="Labour Owes Us" value={formatINR(payables.labourCredit)} tone="good" />}
                    </KpiGrid>
                </>
            )}

            {(profit.unapprovedAreaSqft > 0 || profit.unapprovedCommissionCost > 0) && (
                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr' }}><b>Unapproved (Pending Review)</b></div>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }}>
                        <b>Area</b><b>Contractor Payment Left</b><b>Labour Payment Left</b><b>Commission</b><b>Revenue</b><b>Profit</b>
                    </div>
                    <div className="list-table-format row-item unapproved-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }}>
                        <p>{profit.unapprovedAreaSqft.toLocaleString('en-IN')} sqft</p>
                        <p>{formatINR(profit.unapprovedContractorCost)}</p>
                        <p>{formatINR(profit.unapprovedLabourCost)}</p>
                        <p>{formatINR(profit.unapprovedCommissionCost)}</p>
                        <p>{formatINR(profit.unapprovedRevenue)}</p>
                        <p style={{ color: profit.unapprovedProfit >= 0 ? 'var(--moss)' : '#c0392b' }}>{formatINR(profit.unapprovedProfit)}</p>
                    </div>
                    <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                        Logged work whose cost isn't counted in Profit yet — review it in Payables/Receivables → Deductions to move it in. Revenue/Profit here are what this same unapproved work would add once reviewed and billed.
                        {(profit.directPaymentContractorUnapproved > 0 || profit.directPaymentLabourUnapproved > 0) && (
                            ' Contractor/Labour Payment Left is already net of client direct payments — see Direct Payments below.'
                        )}
                    </p>
                    <p className="admin-subtitle" style={{ padding: '0 20px 16px', fontWeight: 600, color: profit.totalProjectedProfit >= 0 ? 'var(--moss)' : '#c0392b' }}>
                        Total Projected Profit (Approved + Unapproved): {formatINR(profit.totalProjectedProfit)}
                    </p>
                </div>
            )}

            {(profit.directPaymentContractorUnapproved > 0 || profit.directPaymentLabourUnapproved > 0 || profit.directPaymentContractorApproved > 0 || profit.directPaymentLabourApproved > 0) && (
                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr' }}><b>Direct Payments (Client → Workers)</b></div>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <b>Party</b><b>Applied to Unapproved</b><b>Applied to Approved</b>
                    </div>
                    {profit.directPaymentContractorUnapproved + profit.directPaymentContractorApproved > 0 && (
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                            <p>Contractor</p>
                            <p>{formatINR(profit.directPaymentContractorUnapproved)}</p>
                            <p>{formatINR(profit.directPaymentContractorApproved)}</p>
                        </div>
                    )}
                    {profit.directPaymentLabourUnapproved + profit.directPaymentLabourApproved > 0 && (
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                            <p>Labour</p>
                            <p>{formatINR(profit.directPaymentLabourUnapproved)}</p>
                            <p>{formatINR(profit.directPaymentLabourApproved)}</p>
                        </div>
                    )}
                    <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                        Amounts the client paid directly to a worker on this project (Payables → Client Direct Payments), applied to Unapproved first and only spilling into Approved once Unapproved is fully covered.
                    </p>
                </div>
            )}

            {receivable && (
                <>
                    <KpiSectionLabel>Receivables</KpiSectionLabel>
                    <KpiGrid>
                        <KpiCard label="Billed" value={formatINR(receivable.issuedTotal)} />
                        <KpiCard label="Received" value={formatINR(receivable.receivedTotal)} />
                        {receivable.balance > 0 ? (
                            <KpiCard label="Outstanding" value={formatINR(receivable.balance)} tone="danger" />
                        ) : receivable.balance < 0 ? (
                            <KpiCard label="Advance Credit" value={formatINR(Math.abs(receivable.balance))} sub="Received ahead of billing" tone="good" />
                        ) : (
                            <KpiCard label="Outstanding" value={formatINR(0)} tone="good" />
                        )}
                        <KpiCard label="Bills Issued" value={receivable.issuedBillCount} />
                        {receivable.oldestIssuedBillDate && (
                            <KpiCard label="Oldest Issued Bill" value={new Date(receivable.oldestIssuedBillDate).toLocaleDateString()} />
                        )}
                    </KpiGrid>
                </>
            )}

            {contractors.length === 0 ? (
                <div className="admin-empty-state"><p>No contractor has logged work on this project yet.</p></div>
            ) : (
                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
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
                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
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
