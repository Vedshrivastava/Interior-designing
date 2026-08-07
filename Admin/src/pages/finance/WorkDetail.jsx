import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { KpiCard, KpiGrid, KpiSectionLabel, ChartCard, ChartGrid, EmptyChart, ChartTooltip, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
import StyledDatePicker from '../../components/finance/StyledDatePicker';
import StyledMonthPicker from '../../components/finance/StyledMonthPicker';
import ToggleSwitch from '../../components/finance/ToggleSwitch';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/dashboard.css';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

const SCOPES = [
    { key: 'day', label: 'Day' },
    { key: 'month', label: 'Month' },
    { key: 'alltime', label: 'All Time' },
];

// Builds a KpiCard `sub` line out of a headline's own contributing terms —
// same helper as FinanceHome.jsx's Dashboard Payables cards, just
// project-scoped here. Each part is [label, amount, subtract?]; zero-value
// terms are dropped so a simple case doesn't drag along a string of
// "· Advances ₹0 · Deductions ₹0".
const buildBreakdownSub = (parts) => {
    const shown = parts.filter(([, v]) => v);
    return shown.length ? shown.map(([label, v, subtract]) => `${subtract ? '− ' : ''}${label} ${formatINR(Math.abs(v))}`).join('  ') : undefined;
};

/*
 * Tier-2 drill-down for one work — reached identically from the Works
 * tab's "Details" action and from a measurement row's "Details" action
 * (project Measurements tab / Site Operations), same route either way.
 * Everything here comes from GET /reports/work-detail, scoped to exactly
 * one of Day / Month / All Time at a time — showing all three
 * simultaneously (the previous design) got cluttered fast, and it wasn't
 * obvious which numbers were scoped by which filter. Only the picker
 * relevant to the chosen scope is shown; area, contractor/labour cost +
 * breakdown, material used/wasted, and the daily cost/sqft trend all
 * follow the same scope. Revenue/Profit stay All-Time only regardless of
 * scope — they come from issued running bills, which aren't
 * measurement-dated, so a "daily profit" isn't a coherent number.
 */
const WorkDetail = ({ url }) => {
    const { id: projectId, workId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const initialDate = searchParams.get('date') || '';
    const [scope, setScope] = useState(initialDate ? 'day' : 'alltime');
    const [date, setDate] = useState(initialDate || today());
    const [month, setMonth] = useState(thisMonth());
    const [upto, setUpto] = useState(false);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    // Project-wide, not Work-scoped — advances/deductions/payments aren't
    // tracked per individual Work (only Client Direct Payments are, already
    // shown above), so "what's still payable" only has a coherent meaning
    // at the project level, same figures Project Overview's own Payables
    // row shows, surfaced here too so this page doesn't require a trip back
    // to the project just to see them.
    const [payables, setPayables] = useState(null);

    const changeScope = (s) => { setScope(s); setSearchParams({}); };
    const changeDate = (v) => { setDate(v); setSearchParams({}); };

    const fetchData = () => {
        const params = { workId, scope };
        if (scope === 'day') { params.date = date; if (upto) params.upto = 'true'; }
        if (scope === 'month') params.month = month;
        axios.get(`${url}/api/finance/reports/work-detail`, { ...authHeader, params })
            .then(res => { if (res.data.success) setData(res.data.data); else toast.error(res.data.message); })
            .catch(() => toast.error('Error fetching work detail'))
            .finally(() => setLoading(false));
    };
    useEffect(() => { setLoading(true); fetchData(); }, [url, workId, scope, date, month, upto]); // eslint-disable-line react-hooks/exhaustive-deps
    // Measurements, reviews, and client direct payments against this Work
    // can all be recorded from other pages (Site Operations, Payables) —
    // silently refresh in the background rather than requiring a reload.
    // Purchases/stock also belong here: material cost, the Daily Cost/Sqft
    // chart, and Project Material Stock all key off the weighted-average
    // rate a new purchase/return/dump immediately changes.
    useFinanceWsRefresh([
        'financeMeasurementsChanged', 'financeLabourMeasurementsChanged', 'financeWorksChanged',
        'financeWorkReviewChanged', 'clientDirectPaymentsChanged', 'financePurchasesChanged', 'financeStockChanged',
    ], fetchData);

    // Same sumPositive-per-row pattern ProjectDetail.jsx's own Payables row
    // uses — clamped at 0 per row first so one overpaid contractor can't
    // net against a different contractor's real balance due.
    const fetchPayables = () => {
        Promise.all([
            axios.get(`${url}/api/finance/reports/vendor-analysis`, { ...authHeader, params: { projectId } }),
            axios.get(`${url}/api/finance/reports/contractor-analysis`, { ...authHeader, params: { projectId } }),
            axios.get(`${url}/api/finance/reports/labour-analysis`, { ...authHeader, params: { projectId } }),
            axios.get(`${url}/api/finance/expenses/list`, { ...authHeader, params: { projectId } }),
            // Only commission payments explicitly tagged to this project —
            // see ProjectDetail.jsx's identical comment on why commission
            // isn't cleanly project-scoped.
            axios.get(`${url}/api/finance/commission-payments/list`, { ...authHeader, params: { projectId } }),
        ]).then(([vendorRes, contractorRes, labourRes, expenseRes, commissionPaymentRes]) => {
            const sumPositive = (rows, key) => Math.round(rows.reduce((s, r) => s + Math.max(0, r[key]), 0) * 100) / 100;
            // See ProjectDetail.jsx's identical helper — the credit side of
            // the same balance, never netted against the payable figures.
            const sumNegative = (rows, key) => Math.round(rows.reduce((s, r) => s + Math.max(0, -r[key]), 0) * 100) / 100;
            const sumPlain = (rows, key) => Math.round(rows.reduce((s, r) => s + (r[key] || 0), 0) * 100) / 100;
            const commissionPaid = commissionPaymentRes.data.success
                ? Math.round(commissionPaymentRes.data.data.reduce((s, p) => s + p.amount, 0) * 100) / 100
                : 0;
            setPayables({
                vendorPaymentLeft: vendorRes.data.success ? sumPositive(vendorRes.data.data, 'amountOwed') : 0,
                contractorBalancePayable: contractorRes.data.success ? sumPositive(contractorRes.data.data, 'balancePayable') : 0,
                labourBalancePayable: labourRes.data.success ? sumPositive(labourRes.data.data, 'balancePayable') : 0,
                expensePayable: expenseRes.data.success ? sumPositive(expenseRes.data.data, 'balance') : 0,
                vendorCredit: vendorRes.data.success ? sumNegative(vendorRes.data.data, 'amountOwed') : 0,
                contractorCredit: contractorRes.data.success ? sumNegative(contractorRes.data.data, 'balancePayable') : 0,
                labourCredit: labourRes.data.success ? sumNegative(labourRes.data.data, 'balancePayable') : 0,
                // The "why" behind each Payables box below — same breakdown
                // sub-line pattern as the Dashboard's own Vendor/Contractor/
                // Labour Payables cards, just project-scoped here.
                vendorBreakdown: vendorRes.data.success ? {
                    purchases: sumPlain(vendorRes.data.data, 'purchases'),
                    returns: sumPlain(vendorRes.data.data, 'returns'),
                    payments: sumPlain(vendorRes.data.data, 'payments'),
                } : null,
                contractorBreakdown: contractorRes.data.success ? {
                    earnings: sumPlain(contractorRes.data.data, 'earnings'),
                    advances: sumPlain(contractorRes.data.data, 'advances'),
                    deductions: sumPlain(contractorRes.data.data, 'deductions'),
                    directPaymentTotal: sumPlain(contractorRes.data.data, 'directPaymentTotal'),
                    payments: sumPlain(contractorRes.data.data, 'payments'),
                } : null,
                labourBreakdown: labourRes.data.success ? {
                    earnings: sumPlain(labourRes.data.data, 'earnings'),
                    advances: sumPlain(labourRes.data.data, 'advances'),
                    deductions: sumPlain(labourRes.data.data, 'deductions'),
                    directPaymentTotal: sumPlain(labourRes.data.data, 'directPaymentTotal'),
                    payments: sumPlain(labourRes.data.data, 'payments'),
                } : null,
                commissionPaid,
            });
        }).catch(() => {});
    };
    useEffect(() => { if (projectId) fetchPayables(); }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(
        ['financeContractorLedgerChanged', 'financeLabourLedgerChanged', 'financeVendorLedgerChanged', 'financePurchasesChanged', 'financeExpensesChanged', 'financeExpensePaymentsChanged'],
        fetchPayables
    );

    if (loading) {
        return <div className="list add flex-col"><div className="admin-list-container"><div className="admin-empty-state"><p>Loading…</p></div></div></div>;
    }
    if (!data) {
        return <div className="list add flex-col"><div className="admin-list-container"><div className="admin-empty-state"><p>Work not found.</p></div></div></div>;
    }

    const ringDeg = Math.min(360, (data.progressPercent / 100) * 360);

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <button type="button" className="admin-search-clear" style={{ position: 'static', fontSize: '0.8rem', color: 'var(--text-lt)', marginBottom: '8px' }} onClick={() => navigate(`/finance/projects/${projectId}`)}>← Back to Project</button>
                        <p className="admin-subtitle" style={{ margin: '0 0 2px' }}>{data.projectName}</p>
                        <h1>{data.workType}</h1>
                        <p className="admin-subtitle">{data.completedAreaSqft} / {data.estimatedAreaSqft} sqft completed</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                        <div className="measurement-type-toggle" style={{ margin: 0 }}>
                            {SCOPES.map(s => (
                                <button
                                    key={s.key} type="button"
                                    className={`labour-chip${scope === s.key ? ' active' : ''}`}
                                    onClick={() => changeScope(s.key)}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                        {scope === 'day' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ maxWidth: '160px' }}>
                                    <StyledDatePicker value={date} onChange={changeDate} align="right" />
                                </div>
                                <ToggleSwitch checked={upto} onChange={setUpto} label="Up to this date" />
                            </div>
                        )}
                        {scope === 'month' && (
                            <div style={{ maxWidth: '180px' }}>
                                <StyledMonthPicker value={month} onChange={setMonth} align="right" />
                            </div>
                        )}
                    </div>
                </div>

                <h3 style={{ margin: '0 0 4px' }}>{data.scopeLabel}</h3>
                <p className="admin-subtitle" style={{ margin: '0 0 16px' }}>
                    {scope === 'alltime'
                        ? 'Every measurement ever logged against this Work.'
                        : `Everything below (area, cost, material) is scoped to ${scope === 'day' ? 'this date' : 'this month'}.`}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                    <div style={{
                        width: 90, height: 90, borderRadius: '50%',
                        background: `conic-gradient(var(--moss, #2d4a35) ${ringDeg}deg, rgba(201,168,124,0.18) ${ringDeg}deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                            {data.progressPercent}%
                        </div>
                    </div>
                    <p className="admin-subtitle" style={{ margin: 0 }}>Progress toward estimated area (always all-time)</p>
                </div>

                <KpiGrid>
                    <KpiCard label="Area Covered" value={`${data.areaCoveredSqft} sqft`} sub={`${data.scopeLabel}, not the all-time figures below`} />
                    {scope === 'alltime' ? (
                        <>
                            <KpiCard label="Revenue" value={formatINR(data.revenue)} />
                            <KpiCard label="Profit" value={formatINR(data.profit)} tone={data.profit >= 0 ? 'good' : 'danger'} />
                        </>
                    ) : (
                        <KpiCard label="Total Cost" value={formatINR(data.totalCost)} />
                    )}
                    <KpiCard
                        label="Average Material Cost/Sqft"
                        value={`₹${data.averageCostPerSqft.toFixed(2)}`}
                        sub="Mean of each day's cost/sqft ratio, not total cost ÷ total area"
                    />
                    <KpiCard
                        label="Expected Pay (Net of Deductions)"
                        value={formatINR(data.expectedPayNetOfDeductions)}
                        sub={data.deductedTotal > 0 ? `₹${data.expectedPay.toLocaleString('en-IN')} expected − ₹${data.deductedTotal.toLocaleString('en-IN')} deducted` : 'Rate × estimated area, always all-time, not scoped by the picker above'}
                        tone={data.deductedTotal > 0 ? 'danger' : undefined}
                    />
                </KpiGrid>

                {/* Approved = reviewed (financeWorkReview), same meaning
                    "Approved" has everywhere else in the app now — always
                    all-time for this Work, never scoped by the Day/Month/
                    All Time picker above (review isn't a dated concept).
                    Area Approved/Contractor/Labour/Commission here are this
                    Work's own reviewed-and-billable figures; the same
                    still-unreviewed gap for each is broken out in its own
                    Unapproved table below instead of being blended in. */}
                <KpiSectionLabel>Approved — Reviewed (All-Time)</KpiSectionLabel>
                <KpiGrid>
                    <KpiCard label="Area Approved" value={`${data.approvedAreaSqft} sqft`} tone="good" sub={data.unapprovedAreaSqft > 0 ? `${data.unapprovedAreaSqft} sqft still pending review` : 'Everything logged so far is reviewed'} />
                    <KpiCard
                        label="Contractor Cost"
                        value={data.contractorCost > 0 ? formatINR(data.contractorCost) : (data.totalContractorAmount > 0 ? 'Unapproved' : formatINR(0))}
                        tone={data.contractorCost > 0 ? 'good' : (data.totalContractorAmount > 0 ? 'danger' : undefined)}
                        sub={
                            data.unapprovedContractorCost > 0 ? `Total logged: ${formatINR(data.totalContractorAmount)}`
                                : data.rejectedContractorCost > 0 ? `${formatINR(data.rejectedContractorCost)} rejected (already settled)`
                                    : 'All-time'
                        }
                    />
                    <KpiCard
                        label="Labour Cost"
                        value={data.labourCost > 0 ? formatINR(data.labourCost) : (data.totalLabourAmount > 0 ? 'Unapproved' : formatINR(0))}
                        tone={data.labourCost > 0 ? 'good' : (data.totalLabourAmount > 0 ? 'danger' : undefined)}
                        sub={
                            data.unapprovedLabourCost > 0 ? `Total logged: ${formatINR(data.totalLabourAmount)}`
                                : data.rejectedLabourCost > 0 ? `${formatINR(data.rejectedLabourCost)} rejected (already settled)`
                                    : 'All-time'
                        }
                    />
                    <KpiCard
                        label="Commission Cost"
                        value={data.commissionCost > 0 ? formatINR(data.commissionCost) : (data.totalCommissionAmount > 0 ? 'Unapproved' : formatINR(0))}
                        tone={data.commissionCost > 0 ? 'good' : (data.totalCommissionAmount > 0 ? 'danger' : undefined)}
                        sub={data.unapprovedCommissionAmount > 0 ? `Total logged: ${formatINR(data.totalCommissionAmount)}` : 'All-time'}
                    />
                    <KpiCard
                        label="Material Cost"
                        value={data.materialCost > 0 ? formatINR(data.materialCost) : (data.totalMaterialCost > 0 ? 'Unapproved' : formatINR(0))}
                        tone={data.materialCost > 0 ? 'good' : (data.totalMaterialCost > 0 ? 'danger' : undefined)}
                        sub={data.unapprovedMaterialCost > 0 ? `Total logged: ${formatINR(data.totalMaterialCost)}` : 'All-time'}
                    />
                    <KpiCard label="Material Waste Cost" value={formatINR(data.materialWasteCost)} tone={data.materialWasteCost > 0 ? 'danger' : undefined}
                        sub="Wasted material at the same rate it was bought — a real loss, already counted in Profit" />
                </KpiGrid>

                {(data.unapprovedAreaSqft > 0 || data.unapprovedCommissionAmount > 0) && (
                    <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr' }}>
                            <b>{data.heldForAttribution ? 'Unapproved — Held Pending Rejection Attribution' : 'Unapproved (Pending Review)'}</b>
                        </div>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                            <b>Area</b><b>Material Unapproved</b><b>Contractor Unapproved</b><b>Labour Unapproved</b><b>Commission</b><b>Revenue</b><b>Profit</b>
                        </div>
                        <div className="list-table-format row-item unapproved-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                            <p>{data.unapprovedAreaSqft.toLocaleString('en-IN')} sqft</p>
                            <p>{formatINR(data.unapprovedMaterialCost)}</p>
                            <p>{formatINR(data.unapprovedContractorCost)}</p>
                            <p>{formatINR(data.unapprovedLabourCost)}</p>
                            <p>{formatINR(data.unapprovedCommissionAmount)}</p>
                            <p>{formatINR(data.unapprovedRevenue)}</p>
                            <p style={{ color: data.unapprovedProfit >= 0 ? 'var(--moss)' : '#c0392b' }}>{formatINR(data.unapprovedProfit)}</p>
                        </div>
                        {data.heldForAttribution ? (
                            <p className="admin-subtitle" style={{ padding: '0 20px 16px', color: '#c0392b' }}>
                                ⚠ This Work was reviewed — {data.rejectedAreaSqft.toLocaleString('en-IN')} sqft rejected — but that rejection isn't fully attributed to specific contractors/labourers yet (Payables/Receivables → Deductions). Until it is, ALL logged work here shows as Unapproved, not just the rejected portion.
                            </p>
                        ) : (
                            <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                                Logged work on this Work whose cost isn't counted in Profit yet — review it in Payables/Receivables → Deductions to move it in. Revenue/Profit here are what this same unapproved work would add once reviewed and billed.
                                {data.rejectedAreaSqft > 0 && ` Of this, ${data.rejectedAreaSqft.toLocaleString('en-IN')} sqft is permanently rejected (already attributed); the rest is simply pending its first review.`}
                            </p>
                        )}
                        <p className="admin-subtitle" style={{ padding: '0 20px 16px', fontWeight: 600, color: data.totalProjectedProfit >= 0 ? 'var(--moss)' : '#c0392b' }}>
                            Total Projected Profit (Approved + Unapproved): {formatINR(data.totalProjectedProfit)}
                        </p>
                    </div>
                )}

                {(data.contractorDirectPaymentTotal > 0 || data.labourDirectPaymentTotal > 0) && (
                    <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr' }}><b>Direct Payments (Client → Workers)</b></div>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <b>Party</b><b>Total</b>
                        </div>
                        {data.contractorDirectPaymentTotal > 0 && (
                            <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <p>Contractor</p>
                                <p>{formatINR(data.contractorDirectPaymentTotal)}</p>
                            </div>
                        )}
                        {data.labourDirectPaymentTotal > 0 && (
                            <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <p>Labour</p>
                                <p>{formatINR(data.labourDirectPaymentTotal)}</p>
                            </div>
                        )}
                        <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                            Amounts the client paid directly to a worker on this Work (recorded in Payables → Client Direct Payments) — an advance, not tied to specific sqft, so it's a flat reduction against that worker's overall Balance Payable (see their Ledger), not netted against this Work's own Approved/Unapproved split.
                        </p>
                    </div>
                )}

                {payables && (
                    <div style={{ marginBottom: '24px' }}>
                        {/* Distinct from Approved Cost above on purpose — that's
                            approval-gated (unreviewed work might still get
                            rejected). This answers "how much has actually left
                            the company so far": Material counts this Work's own
                            full consumed amount (used material can't be
                            un-used, review or no review); Contractor/Labour/
                            Commission count real cash disbursed project-wide
                            (advances/payments/commission payments aren't
                            tracked per individual Work, same limitation the
                            Payables row below already carries). */}
                        <p className="admin-subtitle" style={{ marginBottom: '4px' }}>
                            Total Expenses So Far — {formatINR(
                                (data.totalMaterialCost || 0) + (data.materialWasteCost || 0)
                                + (payables.contractorBreakdown?.advances || 0) + (payables.contractorBreakdown?.payments || 0)
                                + (payables.labourBreakdown?.advances || 0) + (payables.labourBreakdown?.payments || 0)
                                + (payables.commissionPaid || 0)
                            )}
                        </p>
                        <p className="admin-subtitle" style={{ marginBottom: '10px' }}>
                            {buildBreakdownSub([
                                ['Material Used (this Work)', data.totalMaterialCost],
                                ['Material Waste (this Work)', data.materialWasteCost],
                                ['Contractor Paid (project-wide)', payables.contractorBreakdown?.advances + payables.contractorBreakdown?.payments],
                                ['Labour Paid (project-wide)', payables.labourBreakdown?.advances + payables.labourBreakdown?.payments],
                                ['Commission Paid (project-wide)', payables.commissionPaid],
                            ])}
                        </p>
                        <p className="admin-subtitle" style={{ marginBottom: '10px' }}>
                            Payables — everything {data.projectName} still owes, right now (project-wide, not just this Work; Contractor/Labour count approved earnings only, same as everywhere else).
                        </p>
                        <KpiGrid>
                            <KpiCard label="Vendor Payment Left" value={formatINR(payables.vendorPaymentLeft)} tone={payables.vendorPaymentLeft > 0 ? 'danger' : 'good'}
                                sub={payables.vendorBreakdown && buildBreakdownSub([
                                    ['Purchased', payables.vendorBreakdown.purchases],
                                    ['Returned', payables.vendorBreakdown.returns, true],
                                    ['Paid', payables.vendorBreakdown.payments, true],
                                ])} />
                            <KpiCard label="Contractor Balance Payable" value={formatINR(payables.contractorBalancePayable)} tone={payables.contractorBalancePayable > 0 ? 'danger' : 'good'}
                                sub={payables.contractorBreakdown && buildBreakdownSub([
                                    ['Earned', payables.contractorBreakdown.earnings],
                                    ['Advances', payables.contractorBreakdown.advances, true],
                                    ['Deductions', payables.contractorBreakdown.deductions, true],
                                    ['Direct Pay', payables.contractorBreakdown.directPaymentTotal, true],
                                    ['Paid', payables.contractorBreakdown.payments, true],
                                ])} />
                            <KpiCard label="Labour Balance Payable" value={formatINR(payables.labourBalancePayable)} tone={payables.labourBalancePayable > 0 ? 'danger' : 'good'}
                                sub={payables.labourBreakdown && buildBreakdownSub([
                                    ['Earned', payables.labourBreakdown.earnings],
                                    ['Advances', payables.labourBreakdown.advances, true],
                                    ['Deductions', payables.labourBreakdown.deductions, true],
                                    ['Direct Pay', payables.labourBreakdown.directPaymentTotal, true],
                                    ['Paid', payables.labourBreakdown.payments, true],
                                ])} />
                            <KpiCard label="Expense Payables" value={formatINR(payables.expensePayable)} tone={payables.expensePayable > 0 ? 'danger' : 'good'} />
                        </KpiGrid>
                    </div>
                )}

                {payables && (payables.vendorCredit > 0 || payables.contractorCredit > 0 || payables.labourCredit > 0) && (
                    <div style={{ marginBottom: '24px' }}>
                        <p className="admin-subtitle" style={{ marginBottom: '10px' }}>
                            Credit — project-wide, these parties have already been paid/returned more than what's currently confirmed owed, so they owe the company back instead.
                        </p>
                        <KpiGrid>
                            {payables.vendorCredit > 0 && <KpiCard label="Vendor Owes Us" value={formatINR(payables.vendorCredit)} tone="good" />}
                            {payables.contractorCredit > 0 && <KpiCard label="Contractor Owes Us" value={formatINR(payables.contractorCredit)} tone="good" />}
                            {payables.labourCredit > 0 && <KpiCard label="Labour Owes Us" value={formatINR(payables.labourCredit)} tone="good" />}
                        </KpiGrid>
                    </div>
                )}

                {data.contractorBreakdown.length > 0 && (
                    <div className="list-table finance-table" style={{ marginTop: '24px', marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.1fr 0.8fr 0.8fr 0.9fr 0.9fr 1.1fr' }}>
                            <b>Contractor</b><b>Area (sqft)</b><b>Rate</b><b>Earnings</b><b>Direct Pay</b><b>Material Cost/Sqft</b>
                        </div>
                        {data.contractorBreakdown.map(b => (
                            <div key={b.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.1fr 0.8fr 0.8fr 0.9fr 0.9fr 1.1fr' }}>
                                <p>{b.vendorName}</p>
                                <p>{b.areaSqft}</p>
                                <p>₹{b.rate.toFixed(2)}</p>
                                <p>{formatINR(b.earnings)}</p>
                                <p>{formatINR(b.directPaymentTotal || 0)}</p>
                                <p>{b.materialCostPerSqft != null ? `₹${b.materialCostPerSqft.toFixed(2)}` : '—'}</p>
                            </div>
                        ))}
                        <p className="admin-subtitle" style={{ padding: '8px 20px 16px' }}>
                            Material Cost/Sqft is each contractor's own material use ÷ only the area they covered while logging it — compare across rows to see who gets the most coverage per unit of material.
                        </p>
                    </div>
                )}

                {data.labourBreakdown.length > 0 && (
                    <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.1fr 0.8fr 0.8fr 0.9fr 0.9fr 1.1fr' }}>
                            <b>Labourer</b><b>Area (sqft)</b><b>Rate</b><b>Earnings</b><b>Direct Pay</b><b>Material Cost/Sqft</b>
                        </div>
                        {data.labourBreakdown.map(b => (
                            <div key={b.labourerId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.1fr 0.8fr 0.8fr 0.9fr 0.9fr 1.1fr' }}>
                                <p>{b.labourerName}</p>
                                <p>{b.areaSqft}</p>
                                <p>₹{b.rate.toFixed(2)}</p>
                                <p>{formatINR(b.earnings)}</p>
                                <p>{formatINR(b.directPaymentTotal || 0)}</p>
                                <p>{b.materialCostPerSqft != null ? `₹${b.materialCostPerSqft.toFixed(2)}` : '—'}</p>
                            </div>
                        ))}
                    </div>
                )}

                <ChartGrid>
                    <ChartCard title={`Daily Cost/Sqft: ${data.scopeLabel}`}>
                        {data.dailyBreakdown.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={data.dailyBreakdown}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Line type="monotone" dataKey="costPerSqft" name="Cost/Sqft" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart text={`No measurements ${scope === 'alltime' ? 'yet' : `for ${data.scopeLabel.toLowerCase()}`}.`} />}
                    </ChartCard>
                </ChartGrid>

                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: "1fr" }}><b>Material Used</b></div>
                    {data.materialUsed.length === 0 ? (
                        <div className="admin-empty-state"><p>No material used {scope === 'alltime' ? 'yet' : `for ${data.scopeLabel.toLowerCase()}`}.</p></div>
                    ) : data.materialUsed.map(m => (
                        <div key={m.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <p>{m.materialName}</p>
                            <p>{m.quantity} {m.unit}</p>
                        </div>
                    ))}
                </div>

                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: "1fr" }}><b>Material Wasted (attributed to this work)</b></div>
                    {data.materialWasted.length === 0 ? (
                        <div className="admin-empty-state"><p>No waste attributed to this work {scope === 'alltime' ? 'yet' : `for ${data.scopeLabel.toLowerCase()}`}.</p></div>
                    ) : data.materialWasted.map(m => (
                        <div key={m.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <p>{m.materialName}</p>
                            <p>{m.quantity} {m.unit}</p>
                        </div>
                    ))}
                </div>

                {data.projectLevelWaste.length > 0 && (
                    <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: "1fr" }}><b>Project-Level Waste (not attributed to any specific work)</b></div>
                        <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                            Recorded before per-work waste tracking existed, or entered without picking a work; shown here separately rather than silently folded into or excluded from this work&apos;s numbers.
                        </p>
                        {data.projectLevelWaste.map(m => (
                            <div key={m.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                <p>{m.materialName}</p>
                                <p>{m.quantity} {m.unit}</p>
                            </div>
                        ))}
                    </div>
                )}

                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                        <b>Project Material Stock</b><b>Dumped/Purchased</b><b>Consumed</b><b>Current Stock</b>
                    </div>
                    <p className="admin-subtitle" style={{ padding: '0 20px 8px' }}>
                        Stock is tracked per project, not per Work; material dumped at this site can go to any Work here, so this is always current, not scoped by the selector above.
                    </p>
                    {data.materialStock.length === 0 ? (
                        <div className="admin-empty-state"><p>No material tracked at this project yet.</p></div>
                    ) : data.materialStock.map(m => (
                        <div key={m.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                            <p>{m.materialName}</p>
                            <p>{m.dump} {m.unit}</p>
                            <p>{m.consume} {m.unit}</p>
                            <p style={{ color: m.currentStock < 0 ? '#c0392b' : 'var(--moss)' }}>{m.currentStock} {m.unit}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WorkDetail;
