import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import { useFileDownload } from '../../hooks/useFileDownload';
import DownloadButton from '../../components/finance/DownloadButton';
import WorkTypeRatesManager from '../../components/finance/WorkTypeRatesManager';
import ContractorRatesManager from '../../components/finance/ContractorRatesManager';
import WorkersManager from '../../components/finance/WorkersManager';
import WorksManager from '../../components/finance/WorksManager';
import ProjectQuotationsManager from '../../components/finance/ProjectQuotationsManager';
import QuickAddPicker from '../../components/finance/QuickAddPicker';
import WorkMeasurementsSummary from '../../components/finance/WorkMeasurementsSummary';
import SiteDiaryManager from '../../components/finance/SiteDiaryManager';
import StockMovementsManager from '../../components/finance/StockMovementsManager';
import RunningBillsManager from '../../components/finance/RunningBillsManager';
import ReceiptsManager from '../../components/finance/ReceiptsManager';
import ExpensesManager from '../../components/finance/ExpensesManager';
import DocumentsTab from '../../components/finance/DocumentsTab';
import PhotosTab from '../../components/finance/PhotosTab';
import ProjectTimelineTab from '../../components/finance/ProjectTimelineTab';
import ProjectProfitabilityTab from '../../components/finance/ProjectProfitabilityTab';
import StyledSelect from '../../components/finance/StyledSelect';
import SettingPicker from '../../components/finance/SettingPicker';
import { KpiCard, KpiGrid, ChartCard, ChartGrid, EmptyChart, ChartTooltip, CHART_COLORS, formatINR, buildBreakdownSub, unapprovedPaidNote, reviewGatedValue } from '../../components/finance/DashboardWidgets';
import '../../styles/list.css';
import '../../styles/dashboard.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material', 'advance'];
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;


/*
 * Tier-2 dashboard for one project — KPI cards (revenue through
 * margin%), a progress-over-time chart, a cost-breakdown donut, the
 * material analysis table, and receivable status. Reuses the same
 * report endpoints Reports already computes off of — nothing recomputed
 * client-side.
 */
const ProjectOverviewTab = ({ url, projectId, contractType, status, onViewWorks, onViewExpenses }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [profit, setProfit] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [receivable, setReceivable] = useState(null);
    const [vendors, setVendors] = useState([]);
    // Same shape as the Dashboard's own "Cash, Receivables & Payables" row,
    // just scoped to this one project — Contractor/Labour here is the full
    // balance payable (approved + unapproved, net of advances/deductions/
    // payments), not the Unapproved table's narrower payment-left-on-
    // still-unreviewed-work slice below. Cash/Salary/Commission stay
    // Dashboard-only: cash isn't tracked per project, salary isn't tied to
    // one, and commission payments settle against a referral's whole
    // portfolio, not any single project.
    const [payables, setPayables] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchOverview = useCallback(async () => {
        try {
            const requests = [
                axios.get(`${url}/api/finance/reports/project-profit`, { ...authHeader, params: { projectId } }),
                axios.get(`${url}/api/finance/reports/material-analysis`, { ...authHeader, params: { projectId } }),
                // Same purchases-returns-payments=amountOwed computation
                // Vendor Payables/Vendor Analysis already use, project-scoped
                // — replaces a raw sum of Purchases that ignored Returns
                // entirely and had no Payment Left figure at all.
                axios.get(`${url}/api/finance/reports/vendor-analysis`, { ...authHeader, params: { projectId } }),
                axios.get(`${url}/api/finance/reports/contractor-analysis`, { ...authHeader, params: { projectId } }),
                axios.get(`${url}/api/finance/reports/labour-analysis`, { ...authHeader, params: { projectId } }),
                axios.get(`${url}/api/finance/expenses/list`, { ...authHeader, params: { projectId } }),
                // Only commission payments explicitly tagged to this project —
                // see this component's own comment above on why commission
                // isn't cleanly project-scoped (a referral's payment can
                // settle against their whole portfolio); this is a real but
                // partial figure, not a proportional allocation the way
                // contractor/labour advances/payments get.
                axios.get(`${url}/api/finance/commission-payments/list`, { ...authHeader, params: { projectId } }),
            ];
            if (BILLABLE_CONTRACT_TYPES.includes(contractType)) {
                requests.push(axios.get(`${url}/api/finance/receivables/summary`, { ...authHeader, params: { projectId } }));
            }
            const [profitRes, materialRes, vendorRes, contractorRes, labourRes, expenseRes, commissionPaymentRes, receivableRes] = await Promise.all(requests);
            const commissionPaid = commissionPaymentRes.data.success
                ? round2(commissionPaymentRes.data.data.reduce((s, p) => s + p.amount, 0))
                : 0;
            if (profitRes.data.success) setProfit(profitRes.data.data);
            if (materialRes.data.success) setMaterials(materialRes.data.data);
            if (vendorRes.data.success) {
                // computeVendorAnalysisRows returns every material_supplier
                // vendor company-wide (zero-activity rows included, so a
                // company-wide caller doesn't have to know in advance which
                // vendors did anything) — only the ones with actual activity
                // on this project belong on this project's own page.
                setVendors(vendorRes.data.data.filter(v => v.purchases > 0 || v.returns > 0 || v.payments > 0));
            }
            if (receivableRes?.data.success) setReceivable(receivableRes.data.data);

            // Each contractor-analysis/labour-analysis row is 0 for a vendor/
            // labourer with no activity at all on this project (both the
            // work and the money side are already projectId-filtered
            // upstream), so summing every row is safe — but clamped at 0
            // per row first, so one overpaid contractor can't quietly net
            // against a different contractor's real balance due on the same
            // project (same reasoning as the Client Credit Balance fix).
            const sumPositive = (rows, key) => round2(rows.reduce((s, r) => s + Math.max(0, r[key]), 0));
            // Mirror of sumPositive for the other side of the same balance —
            // a party whose returns/payments/deductions already exceed what's
            // actually confirmed owed to them (approved earnings for
            // Contractor/Labour; purchases for Vendor) owes the company back,
            // not the other way round. Clamped at 0 per row first for the
            // identical reason sumPositive is: one party's credit must never
            // quietly net against a different party's real debt in the
            // combined total.
            const sumNegative = (rows, key) => round2(rows.reduce((s, r) => s + Math.max(0, -r[key]), 0));
            const sumPlain = (rows, key) => round2(rows.reduce((s, r) => s + (r[key] || 0), 0));
            setPayables({
                expenseCount: expenseRes.data.success ? expenseRes.data.data.length : 0,
                vendorPaymentLeft: vendorRes.data.success ? sumPositive(vendorRes.data.data, 'amountOwed') : 0,
                contractorBalancePayable: contractorRes.data.success ? sumPositive(contractorRes.data.data, 'balancePayable') : 0,
                labourBalancePayable: labourRes.data.success ? sumPositive(labourRes.data.data, 'balancePayable') : 0,
                expensePayable: expenseRes.data.success ? sumPositive(expenseRes.data.data, 'balance') : 0,
                // Same three parties, the credit side — never netted against
                // the payable figures above, shown as its own line instead
                // (same "never silently absorbed" treatment Client Credit
                // Balance already gets on the Dashboard).
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
                    tdsTotal: sumPlain(contractorRes.data.data, 'tdsTotal'),
                    holdingTotal: sumPlain(contractorRes.data.data, 'holdingTotal'),
                } : null,
                labourBreakdown: labourRes.data.success ? {
                    earnings: sumPlain(labourRes.data.data, 'earnings'),
                    advances: sumPlain(labourRes.data.data, 'advances'),
                    deductions: sumPlain(labourRes.data.data, 'deductions'),
                    directPaymentTotal: sumPlain(labourRes.data.data, 'directPaymentTotal'),
                    payments: sumPlain(labourRes.data.data, 'payments'),
                    tdsTotal: sumPlain(labourRes.data.data, 'tdsTotal'),
                    holdingTotal: sumPlain(labourRes.data.data, 'holdingTotal'),
                } : null,
                commissionPaid,
            });
        } catch {
            // Overview degrades gracefully — sections just show empty state.
        }
    }, [url, projectId, contractType]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchOverview().finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [fetchOverview]);

    // A client direct payment recorded elsewhere (Payables → Client Direct
    // Payments) changes Contractor/Labour Payment Left and the Direct
    // Payments box below — refresh in the background rather than requiring
    // a tab revisit.
    useFinanceWsRefresh(['clientDirectPaymentsChanged'], (msg) => { if (!msg.projectId || msg.projectId === projectId) fetchOverview(); });
    // Same idea for the new Payables row below — a contractor/labour
    // advance/deduction/payment, a vendor purchase/return/payment, or an
    // expense recorded/settled anywhere else in the app should update this
    // page without needing a revisit.
    useFinanceWsRefresh(
        ['financeContractorLedgerChanged', 'financeLabourLedgerChanged', 'financeVendorLedgerChanged', 'financePurchasesChanged', 'financeExpensesChanged', 'financeExpensePaymentsChanged'],
        fetchOverview
    );

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!profit) return <div className="admin-empty-state"><p>Unable to load project profitability.</p></div>;

    const costBreakdown = [
        { name: 'Material', value: profit.materialCost },
        { name: 'Material Waste', value: profit.materialWasteCost },
        { name: 'Contractor', value: profit.contractorCost },
        { name: 'Commission', value: profit.commissionCost },
        { name: 'Labour', value: profit.labourCost },
        { name: 'Other Expenses', value: profit.otherExpenses },
    ].filter(d => d.value > 0);

    // See DashboardWidgets.jsx's unapprovedPaidNote for why both halves
    // matter — paidByUs comes from the same project-scoped Payables
    // breakdown (payables.contractorBreakdown/labourBreakdown) the
    // "Approved" Payables cards below already fetch.
    const unapprovedNote = unapprovedPaidNote(
        profit.directPaymentContractorTotal + profit.directPaymentLabourTotal,
        (payables?.contractorBreakdown?.advances || 0) + (payables?.contractorBreakdown?.payments || 0)
            + (payables?.labourBreakdown?.advances || 0) + (payables?.labourBreakdown?.payments || 0),
        'contractors/labour',
        (payables?.contractorBreakdown?.tdsTotal || 0) + (payables?.labourBreakdown?.tdsTotal || 0),
    );

    return (
        <div>
            <KpiGrid>
                <KpiCard label="Revenue" value={formatINR(profit.revenue)}
                    sub={receivable ? `${receivable.issuedBillCount} bill${receivable.issuedBillCount === 1 ? '' : 's'} issued to date` : undefined} />
                <KpiCard
                    label="Material Cost"
                    {...reviewGatedValue(profit.materialCost, profit.unapprovedMaterialCost, profit.materialWasteFromRejection)}
                    sub={profit.unapprovedMaterialCost > 0 ? `Total logged: ${formatINR(profit.totalMaterialCost)}`
                        : profit.materialWasteFromRejection > 0 ? `${formatINR(profit.materialWasteFromRejection)} reclassified as waste (rejected work)`
                            : (materials.length > 0 ? `${materials.length} material${materials.length === 1 ? '' : 's'} tracked` : undefined)}
                />
                <KpiCard label="Material Waste Cost" value={formatINR(profit.materialWasteCost)} tone={profit.materialWasteCost > 0 ? 'danger' : undefined}
                    sub={buildBreakdownSub([
                        ['Rejected work', profit.materialWasteFromRejection],
                        ['Physical waste', profit.materialWasteFromStock],
                    ]) || 'Wasted material at the same rate it was bought — a real loss, already counted in Profit'} />
                <KpiCard
                    label="Contractor Cost"
                    {...reviewGatedValue(profit.contractorCost, profit.unapprovedContractorCost, profit.rejectedContractorCost)}
                    sub={[
                        profit.approvedContractorAreaSqft > 0 ? `${profit.approvedContractorAreaSqft.toLocaleString('en-IN')} sqft approved` : null,
                        profit.unapprovedContractorCost > 0 ? `Total logged: ${formatINR(profit.totalContractorCost)}`
                            : profit.rejectedContractorCost > 0 ? `${formatINR(profit.rejectedContractorCost)} rejected (already settled)` : null,
                    ].filter(Boolean).join('  ') || undefined}
                />
                <KpiCard
                    label="Commission Cost"
                    {...reviewGatedValue(profit.commissionCost, profit.unapprovedCommissionCost, profit.rejectedCommissionCost)}
                    sub={profit.unapprovedCommissionCost === 0 && profit.rejectedCommissionCost > 0
                        ? `${formatINR(profit.rejectedCommissionCost)} rejected (already settled)`
                        : (profit.unapprovedCommissionCost > 0 ? `Total logged: ${formatINR(profit.totalCommissionCost)}` : undefined)}
                />
                <KpiCard
                    label="Labour Cost"
                    {...reviewGatedValue(profit.labourCost, profit.unapprovedLabourCost, profit.rejectedLabourCost)}
                    sub={[
                        profit.approvedLabourAreaSqft > 0 ? `${profit.approvedLabourAreaSqft.toLocaleString('en-IN')} sqft approved` : null,
                        profit.unapprovedLabourCost > 0 ? `Total logged: ${formatINR(profit.totalLabourCost)}`
                            : profit.rejectedLabourCost > 0 ? `${formatINR(profit.rejectedLabourCost)} rejected (already settled)` : null,
                    ].filter(Boolean).join('  ') || undefined}
                />
                <KpiCard label="Other Expenses" value={formatINR(profit.otherExpenses)}
                    sub={payables?.expenseCount > 0 ? `${payables.expenseCount} expense${payables.expenseCount === 1 ? '' : 's'} recorded` : undefined} />
                <KpiCard label="Profit" value={formatINR(profit.profit)} tone={profit.profit >= 0 ? 'good' : 'danger'}
                    sub={`Revenue ${formatINR(profit.revenue)} − Costs ${formatINR(profit.materialCost + profit.materialWasteCost + profit.contractorCost + profit.commissionCost + profit.labourCost + profit.otherExpenses)}`} />
                <KpiCard label="Margin %" value={`${Math.round(profit.marginPercent * 10) / 10}%`} tone={profit.marginPercent >= 0 ? 'good' : 'danger'}
                    sub={`Profit ${formatINR(profit.profit)} on Revenue ${formatINR(profit.revenue)}`} />
            </KpiGrid>

            {/* Once a project is completed, Works/Measurements/Diary/Materials
                stop showing on this page (ProjectDetail.jsx's HIDDEN_TABS_
                WHEN_COMPLETED) — everything about what's still financially
                open on it belongs right here instead, so closing it out
                doesn't mean losing sight of Holdings still retained or
                balances still outstanding either way. */}
            {status === 'completed' && payables && (() => {
                const totalHeld = round2((payables.contractorBreakdown?.holdingTotal || 0) + (payables.labourBreakdown?.holdingTotal || 0));
                const totalPayables = round2(payables.vendorPaymentLeft + payables.contractorBalancePayable + payables.labourBalancePayable + payables.expensePayable);
                const totalReceivables = receivable ? receivable.balance : null;
                return (
                    <div style={{ marginBottom: '24px' }}>
                        <p className="admin-subtitle" style={{ marginBottom: '10px' }}>
                            Project Closing Summary — this project is marked Completed; shown below is everything still financially open on it.
                        </p>
                        <KpiGrid>
                            <KpiCard label="Total Held" value={formatINR(totalHeld)} tone={totalHeld > 0 ? 'danger' : 'good'}
                                sub={totalHeld > 0 ? 'Retained from Contractor/Labour payments — still owed until released as a future payment' : 'Nothing retained'} />
                            <KpiCard label="Total Payables (Owed)" value={formatINR(totalPayables)} tone={totalPayables > 0 ? 'danger' : 'good'}
                                sub={buildBreakdownSub([
                                    ['Vendor', payables.vendorPaymentLeft],
                                    ['Contractor', payables.contractorBalancePayable],
                                    ['Labour', payables.labourBalancePayable],
                                    ['Expense', payables.expensePayable],
                                ])} />
                            {totalReceivables != null && (
                                <KpiCard label="Total Receivables" value={formatINR(totalReceivables)} tone={totalReceivables > 0 ? 'danger' : 'good'}
                                    sub="Still owed by the client, against bills issued so far" />
                            )}
                        </KpiGrid>
                    </div>
                );
            })()}

            {/* Distinct from Profit's own Costs above on purpose — Profit only
                counts approval-gated cost (unreviewed contractor/labour work
                might still get rejected, so no confirmed liability exists for
                it yet). This answers a different question — "how much has
                actually left the company so far" — so Material counts its
                FULL consumed amount (used material can't be un-used
                regardless of review status) while Contractor/Labour/
                Commission count actual cash disbursed (advances + payments),
                not what's merely been earned. */}
            {payables && (
                <div className="dash-chart-card ov-card" style={{ marginBottom: '24px' }}>
                    <p className="dash-chart-title">Total Expenses So Far</p>
                    <div className="stat-grid">
                        <div className="stat-block">
                            <span className="stat-block-label">Total Expenses</span>
                            <span className="stat-block-value" style={{ color: '#c0392b' }}>
                                {formatINR(
                                    (profit.totalMaterialCost || 0) + (profit.materialWasteCost || 0)
                                    + (payables.contractorBreakdown?.advances || 0) + (payables.contractorBreakdown?.payments || 0)
                                    + (payables.labourBreakdown?.advances || 0) + (payables.labourBreakdown?.payments || 0)
                                    + (payables.commissionPaid || 0) + (profit.otherExpenses || 0)
                                )}
                            </span>
                        </div>
                    </div>
                    <p className="admin-subtitle" style={{ padding: '8px 20px 0' }}>
                        {buildBreakdownSub([
                            ['Material Used', profit.totalMaterialCost],
                            ['Material Waste', profit.materialWasteCost],
                            ['Contractor Paid', (payables.contractorBreakdown?.advances || 0) + (payables.contractorBreakdown?.payments || 0)],
                            ['Labour Paid', (payables.labourBreakdown?.advances || 0) + (payables.labourBreakdown?.payments || 0)],
                            ['Commission Paid', payables.commissionPaid],
                            ['Other Expenses', profit.otherExpenses],
                        ])}
                    </p>
                    <p className="admin-subtitle" style={{ padding: '4px 20px 16px' }}>
                        Everything the company has actually spent on this project — Material Used counts every bit consumed so far, review or no review (it can&apos;t be un-used); Contractor/Labour count real cash disbursed (advances + payments), not just what&apos;s been earned.
                    </p>
                </div>
            )}

            {/* Stat grids, not a table — each of these is one record's worth
                of labelled figures, not a repeating list, so auto-fit/minmax
                wraps them cleanly at any width without needing a table's
                header-row/column-alignment machinery (or its mobile
                breakage). */}
            {(profit.unapprovedAreaSqft > 0 || profit.unapprovedCommissionCost > 0) && (
                <div className="dash-chart-card ov-card" style={{ marginBottom: '24px' }}>
                    <p className="dash-chart-title">Unapproved (Pending Review)</p>
                    <div className="stat-grid">
                        <div className="stat-block"><span className="stat-block-label">Area</span><span className="stat-block-value">{profit.unapprovedAreaSqft.toLocaleString('en-IN')} sqft</span></div>
                        <div className="stat-block"><span className="stat-block-label">Material Unapproved</span><span className="stat-block-value">{formatINR(profit.unapprovedMaterialCost)}</span></div>
                        <div className="stat-block"><span className="stat-block-label">Contractor Unapproved</span><span className="stat-block-value">{formatINR(profit.unapprovedContractorCost)}</span></div>
                        <div className="stat-block"><span className="stat-block-label">Labour Unapproved</span><span className="stat-block-value">{formatINR(profit.unapprovedLabourCost)}</span></div>
                        <div className="stat-block"><span className="stat-block-label">Commission</span><span className="stat-block-value">{formatINR(profit.unapprovedCommissionCost)}</span></div>
                        <div className="stat-block"><span className="stat-block-label">Revenue</span><span className="stat-block-value">{formatINR(profit.unapprovedRevenue)}</span></div>
                        <div className="stat-block">
                            <span className="stat-block-label">Profit</span>
                            <span className="stat-block-value" style={{ color: profit.unapprovedProfit >= 0 ? 'var(--moss)' : '#c0392b' }}>{formatINR(profit.unapprovedProfit)}</span>
                        </div>
                    </div>
                    <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                        Logged work whose cost isn't counted in Profit yet — review it in Payables/Receivables → Deductions to move it in. Revenue/Profit here are what this same unapproved work would add once reviewed and billed.
                    </p>
                    {/* Approved's own Payables cards below show Direct Pay AND
                        Advances/Paid as subtracted terms right in their
                        breakdown — Unapproved has no equivalent line of its own
                        (none of this is tied to any particular sqft, so it can't
                        be split between Approved/Unapproved the way material
                        cost now is), so this says so explicitly instead of just
                        staying silent about it here while the numbers exist in
                        the Payables/Direct Payments cards below. */}
                    {unapprovedNote && (
                        <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                            {unapprovedNote} (see Payables/Direct Payments below).
                        </p>
                    )}
                    <p className="admin-subtitle" style={{ padding: '0 20px 16px', fontWeight: 600, color: profit.totalProjectedProfit >= 0 ? 'var(--moss)' : '#c0392b' }}>
                        Total Projected Profit (Approved + Unapproved): {formatINR(profit.totalProjectedProfit)}
                    </p>
                </div>
            )}

            {(profit.directPaymentContractorTotal > 0 || profit.directPaymentLabourTotal > 0) && (
                <div className="dash-chart-card ov-card" style={{ marginBottom: '24px' }}>
                    <p className="dash-chart-title">Direct Payments (Client → Workers)</p>
                    <div className="stat-grid">
                        {profit.directPaymentContractorTotal > 0 && (
                            <div className="stat-block"><span className="stat-block-label">Contractor</span><span className="stat-block-value">{formatINR(profit.directPaymentContractorTotal)}</span></div>
                        )}
                        {profit.directPaymentLabourTotal > 0 && (
                            <div className="stat-block"><span className="stat-block-label">Labour</span><span className="stat-block-value">{formatINR(profit.directPaymentLabourTotal)}</span></div>
                        )}
                    </div>
                    <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                        Amounts the client paid directly to a worker on this project (Payables → Client Direct Payments) — an advance, not tied to specific sqft, so it's a flat reduction against that worker's overall Balance Payable, not netted against Unapproved/Approved above.
                    </p>
                </div>
            )}

            <ChartGrid>
                <ChartCard title="Progress Over Time">
                    {profit.progressOverTime?.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={profit.progressOverTime}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    {/* dot needs real size to read as a data point at all —
                                        a single-week project (the common case for a project
                                        still in its first week) has exactly one point, and a
                                        Line with no second point to connect to draws no
                                        visible segment, so a tiny r:2 dot alone looked like
                                        an empty chart. */}
                                    <Line
                                        type="monotone" dataKey="completedAreaSqft" name="Completed Sqft"
                                        stroke={CHART_COLORS[0]} strokeWidth={2}
                                        dot={{ r: 4, strokeWidth: 2, fill: CHART_COLORS[0] }}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                            {profit.progressOverTime.length === 1 && (
                                <p className="admin-subtitle" style={{ margin: '12px 0 0' }}>
                                    Only one week of measurements logged so far — this will grow into a trend line as more weeks are recorded.
                                </p>
                            )}
                        </>
                    ) : <EmptyChart text="No measurements logged yet." />}
                </ChartCard>

                <ChartCard title="Cost Breakdown">
                    {costBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie data={costBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                                    {costBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                </Pie>
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart text="No costs recorded yet." />}
                </ChartCard>
            </ChartGrid>

            {payables && (
                <div style={{ marginBottom: '24px' }}>
                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>
                        Payables — everything this project itself still owes, right now (Contractor/Labour count approved earnings only, same as everywhere else; Vendor/Expense already shown in more detail below).
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
                        <KpiCard label="Expense Payables" value={formatINR(payables.expensePayable)} tone={payables.expensePayable > 0 ? 'danger' : 'good'} onClick={onViewExpenses} />
                        {/* Held from Contractor/Labour payments on this project —
                            already computed unconditionally above (not gated on
                            project status), unlike the Closing Summary's own copy
                            of this same figure further down, which only renders
                            once the project is Completed. */}
                        <KpiCard label="Total Held" value={formatINR((payables.contractorBreakdown?.holdingTotal || 0) + (payables.labourBreakdown?.holdingTotal || 0))}
                            tone={((payables.contractorBreakdown?.holdingTotal || 0) + (payables.labourBreakdown?.holdingTotal || 0)) > 0 ? 'danger' : 'good'}
                            sub={buildBreakdownSub([
                                ['Contractor', payables.contractorBreakdown?.holdingTotal],
                                ['Labour', payables.labourBreakdown?.holdingTotal],
                            ]) || 'Retained from Contractor/Labour payments — still owed until released as a future payment'} />
                    </KpiGrid>
                </div>
            )}

            {payables && (payables.vendorCredit > 0 || payables.contractorCredit > 0 || payables.labourCredit > 0) && (
                <div style={{ marginBottom: '24px' }}>
                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>
                        Credit — this project has already paid/returned more than what's currently confirmed owed, so these parties owe the company back instead.
                    </p>
                    <KpiGrid>
                        {payables.vendorCredit > 0 && <KpiCard label="Vendor Owes Us" value={formatINR(payables.vendorCredit)} tone="good" />}
                        {payables.contractorCredit > 0 && <KpiCard label="Contractor Owes Us" value={formatINR(payables.contractorCredit)} tone="good" />}
                        {payables.labourCredit > 0 && <KpiCard label="Labour Owes Us" value={formatINR(payables.labourCredit)} tone="good" />}
                    </KpiGrid>
                </div>
            )}

            {receivable && (() => {
                const hasCredits = receivable.directPaymentCredits > 0;
                return (
                    <div className="dash-chart-card ov-card" style={{ marginBottom: '24px' }}>
                        <p className="dash-chart-title">Receivable Status</p>
                        <div className="stat-grid">
                            <div className="stat-block"><span className="stat-block-label">Billed</span><span className="stat-block-value">{formatINR(receivable.issuedTotal)}</span></div>
                            <div className="stat-block"><span className="stat-block-label">Received</span><span className="stat-block-value">{formatINR(receivable.receivedTotal)}</span></div>
                            {hasCredits && (
                                <div className="stat-block"><span className="stat-block-label">Client Direct Payment Credits</span><span className="stat-block-value">{formatINR(receivable.directPaymentCredits)}</span></div>
                            )}
                            {hasCredits && (
                                <div className="stat-block">
                                    <span className="stat-block-label">Client Credit Balance</span>
                                    <span className="stat-block-value" style={{ color: receivable.clientCreditBalance > 0 ? 'var(--moss)' : undefined }}>{formatINR(receivable.clientCreditBalance)}</span>
                                </div>
                            )}
                            <div className="stat-block">
                                <span className="stat-block-label">Outstanding</span>
                                <span className="stat-block-value" style={{ color: receivable.balance > 0 ? '#c0392b' : 'var(--moss)' }}>{formatINR(receivable.balance)}</span>
                            </div>
                        </div>
                        {receivable.clientCreditBalance > 0 && (
                            <p className="admin-subtitle" style={{ padding: '0 20px 16px' }}>
                                Client direct payments so far exceed what's been billed yet for this project — Outstanding stays at ₹0 rather than going negative, and the <strong>{formatINR(receivable.clientCreditBalance)} Client Credit Balance</strong> is applied automatically as new bills are issued.
                            </p>
                        )}
                    </div>
                );
            })()}

            {/* Own row classes, not .list-table-format — same reasoning as
                every other table on this page (and Clients/Activity Timeline/
                All Projects before it): name + wrapping self-labeled fields
                on mobile instead of a fixed table forced into a row shape it
                was never built for. */}
            {materials.length > 0 && (
                <div className="dash-chart-card ov-card" style={{ marginBottom: '24px' }}>
                    <p className="dash-chart-title">Materials</p>
                    <div className="ov-material-row ov-header">
                        <b>Material</b><b>Dumped</b><b>Consumed</b><b>Wasted</b><b>Current Stock</b><b>Avg Cost</b><b>Cost/Sqft</b>
                    </div>
                    {materials.map(m => (
                        <div key={m.materialId} className="ov-material-row">
                            <p className="ov-name">{m.materialName}</p>
                            <div className="ov-fields">
                                <div className="ov-field"><span className="ov-field-label">Dumped</span><span className="ov-field-value">{m.totalDumped} {m.unit}</span></div>
                                <div className="ov-field"><span className="ov-field-label">Consumed</span><span className="ov-field-value">{m.totalConsumed} {m.unit}</span></div>
                                <div className="ov-field"><span className="ov-field-label">Wasted</span><span className="ov-field-value">{m.totalWasted} {m.unit}</span></div>
                                <div className="ov-field"><span className="ov-field-label">Current Stock</span><span className="ov-field-value">{m.currentStock} {m.unit}</span></div>
                                <div className="ov-field"><span className="ov-field-label">Avg Cost</span><span className="ov-field-value">{formatINR(m.weightedAverageCost)}{m.unit ? `/${m.unit}` : ''}</span></div>
                                <div className="ov-field"><span className="ov-field-label">Cost/Sqft</span><span className="ov-field-value">{m.areaCoveredSqft > 0 ? `₹${m.costPerSqft.toFixed(2)}/sqft` : '—'}</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {vendors.length > 0 && (
                <div className="dash-chart-card ov-card" style={{ marginBottom: '24px' }}>
                    <p className="dash-chart-title">Vendors Supplying This Project</p>
                    <div className="ov-vendor-row ov-header">
                        <b /><b>Purchased</b><b>Returns</b><b>Payment Left</b>
                    </div>
                    {vendors.map(v => (
                        <div key={v.vendorId} className="ov-vendor-row">
                            <p className="ov-name">{v.vendorName}</p>
                            <div className="ov-fields">
                                <div className="ov-field"><span className="ov-field-label">Purchased</span><span className="ov-field-value">{formatINR(v.purchases)}</span></div>
                                <div className="ov-field"><span className="ov-field-label">Returns</span><span className="ov-field-value">{formatINR(v.returns)}</span></div>
                                <div className="ov-field">
                                    <span className="ov-field-label">Payment Left</span>
                                    <span className="ov-field-value" style={{ color: v.amountOwed > 0 ? '#c0392b' : 'var(--moss)' }}>{formatINR(v.amountOwed)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Same full-width pill button as ActivityCard's "View Full
                Timeline" — the previous plain right-aligned text link had a
                thin, easy-to-miss tap target on mobile. */}
            <button type="button" className="dash-activity-viewall" onClick={onViewWorks}>
                View all Works
                <FontAwesomeIcon icon={faArrowRight} />
            </button>
        </div>
    );
};

const TABS = [
    { key: 'overview',     label: 'Overview' },
    { key: 'quotations',   label: 'Quotations' },
    { key: 'works',        label: 'Works & Rates' },
    { key: 'measurements', label: 'Measurements' },
    { key: 'diary',        label: 'Diary' },
    { key: 'materials',    label: 'Materials' },
    { key: 'contractors',  label: 'Workers' },
    { key: 'supervisors',  label: 'Supervisors' },
    { key: 'runningBills', label: 'Running Bills' },
    { key: 'receipts',     label: 'Receipts' },
    { key: 'expenses',     label: 'Expenses' },
    { key: 'documents',    label: 'Documents' },
    { key: 'photos',       label: 'Photos' },
    { key: 'timeline',     label: 'Timeline' },
    { key: 'profitability', label: 'Profitability' },
];

// Once a project is completed there's nothing left to measure, log, or
// rate — these four tabs are all about work still in progress, so they'd
// only ever show stale, frozen-in-time data past that point. Everything
// else (Workers, Running Bills, Receipts, Expenses, Documents, Photos,
// Timeline, Profitability) stays visible — those are historical records,
// not active-work tools.
const HIDDEN_TABS_WHEN_COMPLETED = ['works', 'measurements', 'diary', 'materials'];

const CONTRACT_TYPE_LABEL = { with_material: 'With Material', without_material: 'Without Material', advance: 'Advance' };
const STATUS_LABEL = { draft: 'Draft', active: 'Active', completed: 'Completed' };

const ProjectDetail = ({ url }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [activeTab, setActiveTab] = useState('overview');
    const [worksVersion, setWorksVersion] = useState(0);
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [completionBlockers, setCompletionBlockers] = useState(null); // [{category,label,amount}] | null
    const [reopening, setReopening] = useState(false);
    const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);
    const [advanceNotes, setAdvanceNotes] = useState('');
    const [advancePaymentMode, setAdvancePaymentMode] = useState('');
    const [advanceBankAccountId, setAdvanceBankAccountId] = useState('');
    const [advanceUtrNumber, setAdvanceUtrNumber] = useState('');
    const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
    const [paymentModes, setPaymentModes] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [markingInvoiced, setMarkingInvoiced] = useState(false);
    const [markingReceived, setMarkingReceived] = useState(false);
    const { downloading: downloadingReceipt, progress: receiptProgress, run: runReceiptDownload } = useFileDownload(authHeader);

    // Advance-type referral commission: a flat manually-typed amount
    // (see financeProject.referralCommissionAmount), editable any time from
    // Overview and re-confirmed once more right before Mark Completed
    // proceeds — that confirm step is the last real chance to get it right.
    const [commissionInput, setCommissionInput] = useState('');
    const [savingCommission, setSavingCommission] = useState(false);
    const [completionCommissionConfirm, setCompletionCommissionConfirm] = useState(null); // { amount } | null
    const [confirmingCompletion, setConfirmingCompletion] = useState(false);

    // Progress % is never stored — computed here from the same works list
    // WorksManager fetches, just so it's visible without switching tabs.
    const [progressPct, setProgressPct] = useState(null);

    const fetchProject = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/projects/${id}`, authHeader);
            if (res.data.success) {
                setProject(res.data.data.project);
            } else toast.error(res.data.message);
        } catch { toast.error('Error fetching project'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchProject(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (project) setCommissionInput(String(project.referralCommissionAmount || 0));
    }, [project?._id]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchPaymentModes = () =>
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'payment_mode' } })
            .then(res => { if (res.data.success) setPaymentModes(res.data.data.map(s => s.name)); }).catch(() => {});

    useEffect(() => {
        Promise.all([
            fetchPaymentModes(),
            axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
                .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {}),
        ]).finally(() => setRefDataLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // Same fetch as fetchProject, minus the loading flag — used for live
    // (WebSocket-driven) refreshes so the page doesn't flash back to its
    // "Loading…" state every time a contractor assignment changes
    // somewhere else on this same page (or from another session).
    const refreshContractors = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/projects/${id}`, authHeader);
            if (res.data.success) {
                setProject(res.data.data.project);
            }
        } catch { /* silent — next tab revisit or WS message will retry */ }
    };

    // Picking from the dropdown only stages the change — a single stray
    // click here would silently reassign who's responsible for the whole
    // project, so it's held in pendingSupervisor until confirmed. The name
    // is resolved separately (QuickAddPicker only hands back an id) purely
    // so the confirm dialog can say who, not just "change supervisor?".
    const [pendingSupervisor, setPendingSupervisor] = useState(null); // { id, name } | null
    const [savingSupervisor, setSavingSupervisor] = useState(false);

    const stageSupervisorChange = async (employeeId) => {
        if (!employeeId) { setPendingSupervisor({ id: '', name: 'None' }); return; }
        try {
            const res = await axios.get(`${url}/api/finance/employees/list`, authHeader);
            const name = res.data.success ? (res.data.data.find(e => e._id === employeeId)?.name || 'this employee') : 'this employee';
            setPendingSupervisor({ id: employeeId, name });
        } catch { setPendingSupervisor({ id: employeeId, name: 'this employee' }); }
    };

    const confirmSupervisorChange = async () => {
        setSavingSupervisor(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/update`, { _id: id, assignedSupervisorId: pendingSupervisor.id || null }, authHeader);
            if (res.data.success) { toast.success('Supervisor updated'); await refreshContractors(); setPendingSupervisor(null); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error updating supervisor'); }
        finally { setSavingSupervisor(false); }
    };

    const refreshProgress = () => {
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId: id } })
            .then(res => {
                if (!res.data.success) return;
                const works = res.data.data;
                const estimated = works.reduce((sum, w) => sum + (w.estimatedAreaSqft || 0), 0);
                const completed = works.reduce((sum, w) => sum + (w.completedAreaSqft || 0), 0);
                setProgressPct(estimated > 0 ? Math.round((completed / estimated) * 100) : null);
            })
            .catch(() => {});
    };

    useEffect(refreshProgress, [url, id, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    // Real-time sync for the Works section — Works, Work Type Rates,
    // Contractor Rates, and contractor assignments all broadcast their own
    // projectId-scoped WebSocket event on change (see the respective
    // controllers). A single subscription here bumps worksVersion (which
    // WorksManager/WorkTypeRatesManager/ContractorRatesManager already
    // re-fetch on) and refreshes this page's own contractors/progress
    // state, so every tab reflects a change the instant it happens —
    // whether it came from this page's own Quick Add flow, a different
    // tab, or another admin's session — not just on next tab revisit.
    const WORKS_SECTION_EVENTS = ['financeWorksChanged', 'financeWorkContractorAssignmentsChanged', 'financeWorkTypeRatesChanged', 'financeContractorRatesChanged', 'financeWorkLabourAssignmentsChanged'];
    useWebSocket(useCallback((msg) => {
        if (msg.projectId !== id || !WORKS_SECTION_EVENTS.includes(msg.type)) return;
        setWorksVersion(v => v + 1);
        if (msg.type === 'financeWorksChanged' || msg.type === 'financeWorkContractorAssignmentsChanged') {
            refreshContractors();
            refreshProgress();
        }
    }, [id])); // eslint-disable-line react-hooks/exhaustive-deps

    const activate = async () => {
        setActivating(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/activate`, { _id: id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchProject(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error activating project'); }
        finally { setActivating(false); }
    };

    // Warn-don't-block: the first call (no override) either completes
    // outright or comes back with a blockers[] list to show; "Complete
    // Anyway" in that modal resends with confirmOverride:true.
    const completeProject = async (confirmOverride = false) => {
        setCompleting(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/complete`, { _id: id, confirmOverride }, authHeader);
            // A 200 always means success here — the backend returns 400
            // whenever blockers stop completion, which axios routes to the
            // catch block below instead.
            toast.success(res.data.message);
            setCompletionBlockers(null);
            // A hidden-when-completed tab (Works & Rates, Measurements, Diary,
            // Materials) has no pill to click back to once its button
            // disappears below — land on Overview instead of leaving whatever
            // was open stranded.
            setActiveTab('overview');
            await fetchProject();
        } catch (err) {
            if (err.response?.data?.blockers) setCompletionBlockers(err.response.data.blockers);
            else toast.error(err.response?.data?.message || 'Error completing project');
        } finally { setCompleting(false); }
    };

    const reopenProject = async () => {
        setReopening(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/reopen`, { _id: id }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                setReopenConfirmOpen(false);
                await fetchProject();
            } else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error reopening project'); }
        finally { setReopening(false); }
    };

    const saveCommission = async () => {
        setSavingCommission(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/referral-commission`, { _id: id, referralCommissionAmount: commissionInput }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchProject(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error updating referral commission'); }
        finally { setSavingCommission(false); }
    };

    // Advance projects with a referral vendor set always re-confirm the
    // commission amount right here, even if it was already entered/edited
    // earlier from Overview — this is the last real chance to get it right.
    const handleMarkCompletedClick = () => {
        if (project.contractType === 'advance' && project.referralId) {
            setCompletionCommissionConfirm({ amount: String(project.referralCommissionAmount || 0) });
        } else {
            completeProject(false);
        }
    };

    const confirmCommissionAndComplete = async () => {
        setConfirmingCompletion(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/referral-commission`, { _id: id, referralCommissionAmount: completionCommissionConfirm.amount }, authHeader);
            if (!res.data.success) { toast.error(res.data.message); return; }
            setCompletionCommissionConfirm(null);
            await completeProject(false);
        } catch (err) { toast.error(err.response?.data?.message || 'Error confirming referral commission'); }
        finally { setConfirmingCompletion(false); }
    };

    // Revisitable here — not just the New Project Wizard's one-time step.
    const markAdvanceInvoiced = async () => {
        setMarkingInvoiced(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/advance-invoiced`, { _id: id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchProject(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error updating advance status'); }
        finally { setMarkingInvoiced(false); }
    };

    const markAdvanceReceived = async () => {
        setMarkingReceived(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/advance-received`, {
                _id: id, notes: advanceNotes,
                paymentMode: advancePaymentMode, bankAccountId: advanceBankAccountId, utrNumber: advanceUtrNumber,
            }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                setAdvanceNotes(''); setAdvancePaymentMode(''); setAdvanceBankAccountId(''); setAdvanceUtrNumber('');
                setAdvanceModalOpen(false);
                await fetchProject();
            }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording advance payment'); }
        finally { setMarkingReceived(false); }
    };

    // Protected download — a plain <a href> can't carry the Bearer token,
    // so this fetches the PDF as a blob (see useFileDownload); its
    // onDownloadProgress gives a real, live byte/percent readout while the
    // transfer is in progress.
    const downloadAdvanceReceipt = () => runReceiptDownload(
        url, `/api/finance/projects/${id}/advance-receipt/download`, `Advance-Receipt-${project.name}.pdf`, {}, 'Error downloading advance receipt'
    );

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
                    {project.status === 'active' && (
                        <button type="button" className="add-point-btn" disabled={completing} onClick={handleMarkCompletedClick}>
                            {completing ? 'Checking…' : 'Mark Completed'}
                        </button>
                    )}
                    {project.status === 'completed' && (
                        <button type="button" className="add-point-btn" disabled={reopening} onClick={() => setReopenConfirmOpen(true)}>
                            {reopening ? 'Reopening…' : 'Reopen Project'}
                        </button>
                    )}
                </div>

                <div className="admin-category-scroll">
                    {(project.status === 'completed' ? TABS.filter(t => !HIDDEN_TABS_WHEN_COMPLETED.includes(t.key)) : TABS).map(t => (
                        <button key={t.key} className={`admin-cat-pill${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'overview' && (
                    <div>
                        {/* Own row class, not .list-table-format — that class's
                            mobile transform is hard-coded for a completely
                            different row shape (image + title + subtitle +
                            action buttons) and mangles a plain label/value
                            settings list the same way it mangled every other
                            table on this page before this pass. */}
                        <div className="dash-chart-card project-info-card" style={{ marginBottom: '24px' }}>
                            <p className="dash-chart-title">Project Details</p>
                            <div className="project-info-row"><b>Site Location</b><p>{project.siteLocation || '-'}</p></div>
                            <div className="project-info-row"><b>Start Date</b><p>{project.startDate ? new Date(project.startDate).toLocaleDateString() : '-'}</p></div>
                            <div className="project-info-row"><b>Estimated Area</b><p>{project.estimatedAreaSqft || 0} sqft</p></div>
                            <div className="project-info-row"><b>Material Tracking</b><p>{project.materialTrackingEnabled ? 'Enabled' : 'Disabled'}</p></div>
                            {project.contractType === 'advance' && (
                                <>
                                    <div className="project-info-row"><b>Total Estimated Cost</b><p>₹{project.totalEstimatedCost?.toLocaleString('en-IN')}</p></div>
                                    <div className="project-info-row"><b>Advance Amount</b><p>₹{project.advanceAmount?.toLocaleString('en-IN')}</p></div>
                                    {project.referralId && (
                                        <div className="project-info-row">
                                            <b>Referral Commission</b>
                                            <div className="add-product-name" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', margin: 0, flexWrap: 'wrap' }}>
                                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={commissionInput} onChange={e => setCommissionInput(e.target.value)} style={{ maxWidth: '140px' }} />
                                                {Number(commissionInput) !== (project.referralCommissionAmount || 0) && (
                                                    <button type="button" className="add-point-btn" disabled={savingCommission} onClick={saveCommission}>
                                                        {savingCommission ? 'Saving…' : 'Save'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div className="project-info-row">
                                        <b>Advance Invoiced</b>
                                        <div>
                                            {project.advanceInvoiced ? (
                                                <span>Yes, {new Date(project.advanceInvoicedAt).toLocaleDateString()}</span>
                                            ) : (
                                                <button type="button" className="add-point-btn" disabled={markingInvoiced} onClick={markAdvanceInvoiced}>
                                                    {markingInvoiced ? 'Saving…' : 'Mark Invoiced'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="project-info-row">
                                        <b>Advance Received</b>
                                        <div>
                                            {project.advanceReceived ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                    <span>Yes, {new Date(project.advanceReceivedAt).toLocaleDateString()}</span>
                                                    <DownloadButton
                                                        as="p" downloading={downloadingReceipt} progress={receiptProgress}
                                                        idleLabel="Download Receipt" onClick={downloadAdvanceReceipt} className="cursor edit-action" style={{ margin: 0 }}
                                                    />
                                                </div>
                                            ) : (
                                                <button type="button" className="add-point-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setAdvanceModalOpen(true)}>
                                                    Record Received
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="project-info-row"><b>Notes</b><p>{project.notes || '-'}</p></div>
                        </div>
                        <ProjectOverviewTab url={url} projectId={id} contractType={project.contractType} status={project.status} onViewWorks={() => setActiveTab('works')} onViewExpenses={() => setActiveTab('expenses')} />
                    </div>
                )}

                {advanceModalOpen && ReactDOM.createPortal(
                    <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                        <div className="loader-modal-box edit-modal">
                            <h2>Record Advance Received</h2>
                            <p className="admin-subtitle" style={{ margin: '4px 0 16px' }}>
                                Advance of ₹{project.advanceAmount?.toLocaleString('en-IN')} for "{project.name}": how did it arrive?
                            </p>
                            <div className="add-product-name flex-col" style={{ marginBottom: '20px' }}>
                                <p>Payment Mode</p>
                                <SettingPicker
                                    url={url} settingType="payment_mode" options={paymentModes} onAdded={fetchPaymentModes}
                                    value={advancePaymentMode} onChange={setAdvancePaymentMode} placeholder="Cash, Bank Transfer, Cheque…"
                                    loading={refDataLoading}
                                />
                            </div>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Received Into (Your Bank Account)</p>
                                    <StyledSelect
                                        value={advanceBankAccountId} onChange={setAdvanceBankAccountId} placeholder="Cash, no bank account" loading={refDataLoading}
                                        options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                                    />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>UTR / Cheque Number</p>
                                    <input type="text" value={advanceUtrNumber} onChange={e => setAdvanceUtrNumber(e.target.value)} placeholder="Optional, reference number" />
                                </div>
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Notes</p>
                                    <input type="text" value={advanceNotes} onChange={e => setAdvanceNotes(e.target.value)} placeholder="Optional" />
                                </div>
                            </div>
                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={() => setAdvanceModalOpen(false)} disabled={markingReceived}>Cancel</button>
                                <button type="button" className="add-btn" disabled={markingReceived} onClick={markAdvanceReceived}>
                                    {markingReceived ? 'Saving…' : 'Record Received'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {activeTab === 'works' && (
                    <div>
                        <WorksManager url={url} projectId={id} worksVersion={worksVersion} onWorksChanged={() => setWorksVersion(v => v + 1)} />
                        <div style={{ marginTop: '32px' }}>
                            <WorkTypeRatesManager url={url} projectId={id} worksVersion={worksVersion} referralVendorName={project.referralId?.name} />
                        </div>
                        <h3 style={{ margin: '28px 0 8px' }}>Contractor Rates</h3>
                        <ContractorRatesManager url={url} projectId={id} worksVersion={worksVersion} />
                        <h3 style={{ margin: '28px 0 8px' }}>Labour Rates</h3>
                        <WorkersManager url={url} projectId={id} worksVersion={worksVersion} />
                    </div>
                )}

                {activeTab === 'measurements' && (
                    <div>
                        <h3 style={{ margin: '0 0 16px' }}>Measurements</h3>
                        <WorkMeasurementsSummary url={url} projectId={id} worksVersion={worksVersion} />
                    </div>
                )}

                {activeTab === 'diary' && <SiteDiaryManager url={url} projectId={id} />}

                {activeTab === 'materials' && <StockMovementsManager url={url} projectId={id} />}

                {activeTab === 'contractors' && (
                    <div>
                        <h3 style={{ margin: '0 0 8px' }}>Contractor Rates</h3>
                        <ContractorRatesManager url={url} projectId={id} worksVersion={worksVersion} />

                        <h3 style={{ margin: '28px 0 8px' }}>Labour Rates</h3>
                        <WorkersManager url={url} projectId={id} worksVersion={worksVersion} />
                    </div>
                )}

                {activeTab === 'supervisors' && (
                    <div>
                        <h3 style={{ margin: '0 0 4px' }}>Supervisor</h3>
                        <p className="admin-subtitle" style={{ margin: '0 0 16px' }}>
                            The employee overseeing this project on site, shown wherever this project appears under Supervisors, Attendance, and Site Operations.
                        </p>
                        <div className="add-product-name flex-col" style={{ maxWidth: '520px' }}>
                            <p>Assigned Supervisor</p>
                            <QuickAddPicker
                                url={url} resourceKey="employees"
                                value={project.assignedSupervisorId?._id || ''}
                                onChange={stageSupervisorChange}
                                filter={e => e.role === 'supervisor'} presetValues={{ role: 'supervisor' }}
                                placeholder="None"
                            />
                        </div>
                        {!project.assignedSupervisorId && project.assignedSupervisor && (
                            <p className="admin-subtitle" style={{ margin: '12px 0 0' }}>
                                Legacy free-text supervisor on record: "{project.assignedSupervisor}". Pick someone above to replace it with a real employee link.
                            </p>
                        )}

                        {pendingSupervisor && ReactDOM.createPortal(
                            <div className="bin-confirm-backdrop" onClick={() => !savingSupervisor && setPendingSupervisor(null)}>
                                <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                                    <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                                    <h3>Change Supervisor?</h3>
                                    <p className="bin-confirm-name">{pendingSupervisor.name}</p>
                                    <p className="bin-confirm-warning">This replaces the supervisor assigned to "{project.name}", visible immediately across Attendance and Site Operations.</p>
                                    <div className="bin-confirm-actions">
                                        <button className="bin-btn-cancel" onClick={() => setPendingSupervisor(null)} disabled={savingSupervisor}>Cancel</button>
                                        <button className="bin-btn-delete" onClick={confirmSupervisorChange} disabled={savingSupervisor}>{savingSupervisor ? 'Saving…' : 'Yes, Change'}</button>
                                    </div>
                                </div>
                            </div>,
                            document.body
                        )}
                    </div>
                )}

                {activeTab === 'quotations' && <ProjectQuotationsManager url={url} projectId={id} />}
                {activeTab === 'runningBills' && <RunningBillsManager url={url} projectId={id} />}
                {activeTab === 'receipts' && <ReceiptsManager url={url} projectId={id} />}
                {activeTab === 'expenses' && <ExpensesManager url={url} projectId={id} />}
                {activeTab === 'documents' && (
                    <DocumentsTab
                        url={url} apiBase="project-documents" scopeParam="projectId" scopeId={id}
                        title="Documents" subtitle="Work orders, site approvals, floor plans, specific to this project."
                        emptyText="No documents on file for this project yet."
                    />
                )}
                {activeTab === 'photos' && <PhotosTab url={url} projectId={id} />}
                {activeTab === 'timeline' && <ProjectTimelineTab url={url} projectId={id} />}
                {activeTab === 'profitability' && <ProjectProfitabilityTab url={url} projectId={id} contractType={project.contractType} />}
            </div>

            {completionCommissionConfirm && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Confirm Referral Commission</h2>
                        <p className="admin-subtitle" style={{ margin: '4px 0 16px' }}>
                            Referral Person: {project.referralId?.name || 'None'}. Confirm the flat commission amount before completing "{project.name}".
                        </p>
                        <div className="add-product-name flex-col">
                            <p>Referral Commission (₹)</p>
                            <input
                                type="number" onWheel={e => e.target.blur()} min="0" step="any" value={completionCommissionConfirm.amount}
                                onChange={e => setCompletionCommissionConfirm({ amount: e.target.value })}
                            />
                        </div>
                        <div className="edit-modal-actions">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setCompletionCommissionConfirm(null)} disabled={confirmingCompletion || completing}>Cancel</button>
                            <button type="button" className="add-btn" disabled={confirmingCompletion || completing} onClick={confirmCommissionAndComplete}>
                                {confirmingCompletion || completing ? 'Confirming…' : 'Confirm & Continue'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {completionBlockers && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !completing && setCompletionBlockers(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>This project has outstanding items</h3>
                        <p className="bin-confirm-name" style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                            {completionBlockers.map((b, i) => (
                                <span key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                                    <span>{b.label}</span>
                                    <b style={{ whiteSpace: 'nowrap' }}>{b.amount < 0 ? '-' : ''}₹{Math.abs(b.amount).toLocaleString('en-IN')}</b>
                                </span>
                            ))}
                        </p>
                        <p className="bin-confirm-warning">A project can still be completed with these left open; this is just a heads-up before you do.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setCompletionBlockers(null)} disabled={completing}>Cancel</button>
                            <button className="bin-btn-delete" onClick={() => completeProject(true)} disabled={completing}>
                                {completing ? 'Completing…' : 'Complete Anyway'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {reopenConfirmOpen && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !reopening && setReopenConfirmOpen(false)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon bin-confirm-icon-neutral"><i className="fa-solid fa-rotate-left" /></div>
                        <h3>Reopen "{project.name}"?</h3>
                        <p className="bin-confirm-warning">
                            This sets the project back to Active and restores its Works and team assignments.
                            Any labourer already staffed onto another Work in the meantime won't be re-added automatically
                            — you'll need to reassign them by hand.
                        </p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setReopenConfirmOpen(false)} disabled={reopening}>Cancel</button>
                            <button className="bin-btn-confirm" onClick={reopenProject} disabled={reopening}>
                                {reopening ? 'Reopening…' : 'Reopen Project'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ProjectDetail;
