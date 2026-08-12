import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useFinanceWsRefresh } from '../hooks/useFinanceWsRefresh';
import {
    ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import {
    faMoneyBillTransfer, faArrowTrendUp, faBuildingColumns, faWallet, faFileInvoiceDollar,
    faCartShopping, faHardHat, faReceipt, faBuilding, faClipboardList, faPersonDigging,
    faRulerCombined, faTriangleExclamation, faMoneyBillWave, faHandHoldingDollar, faUsers, faFileInvoice, faLock,
} from '@fortawesome/free-solid-svg-icons';
import { KpiCard, KpiGrid, KpiSectionLabel, ChartCard, ChartGrid, EmptyChart, ChartSkeleton, ActivityCard, ChartTooltip, CHART_COLORS, formatINR, truncateLabel, ProjectNameTick, buildBreakdownSub, unapprovedPaidNote } from '../components/finance/DashboardWidgets';
import '../styles/welcome.css';
import '../styles/list.css';

// Kept outside the component so it survives a route remount — navigating
// away and back to the dashboard shows the last-known view instantly
// instead of every card/chart reverting to its skeleton again, while a
// fresh fetch quietly brings it up to date in the background. Only a
// genuine first load (no cache yet) shows any skeleton at all.
let dashboardCache = null;

/*
 * Tier 0 — Company Dashboard. Answers "how's the business doing right now"
 * in ~10 seconds: KPI cards (every one a doorway into its Tier-1 home) plus
 * exactly four charts. Deliberately does NOT show granular tables here —
 * that's what clicking a card/chart element is for.
 */
const FinanceHome = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    // Lazy-initialized straight from dashboardCache (not null/true, then
    // synced in an effect after first paint) — same pattern as
    // ClientsPage/ProjectsList's caches. Reading the cache only inside a
    // mount effect meant every single visit, cached or not, painted one
    // frame of the loading skeleton before the effect could flip it off —
    // a visible "flash of reload" on every revisit that the other Tier-0/1
    // pages don't have.
    const [summary, setSummary] = useState(dashboardCache?.summary ?? null);
    const [trends, setTrends] = useState(dashboardCache?.trends ?? null);
    const [projectProfits, setProjectProfits] = useState(dashboardCache?.projectProfits ?? []);
    const [payablesBreakdown, setPayablesBreakdown] = useState(dashboardCache?.payablesBreakdown ?? null);
    // Two independent flags, not one — summary/trends resolve in the first
    // request batch, but projectProfits/payablesBreakdown depend on a
    // second, chained N+1 fan-out (salary/commission ledgers, per-project
    // profit) that's meaningfully slower. Gating everything behind a single
    // flag meant the whole page (including the KPI cards, which only need
    // the fast batch) sat behind a blank spinner waiting on the slow one.
    const [phase1Loading, setPhase1Loading] = useState(!dashboardCache);
    const [phase2Loading, setPhase2Loading] = useState(!dashboardCache);

    // Check-on-load, not a background job — no cron infrastructure exists
    // in this codebase. Silent: de-duplication (24h cooldown per
    // material/bill) and the actual notification happen server-side via
    // email; there's nothing for the dashboard itself to display.
    useEffect(() => {
        if (!token) return;
        axios.get(`${url}/api/finance/settings/check-alerts`, authHeader).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // Guards state updates after unmount for both the mount-triggered load
    // and any later WebSocket-triggered background refresh below.
    const aliveRef = useRef(true);
    useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

    // dashboard-summary alone routinely takes seconds (several sequential
    // aggregation stages), so a WS-triggered refresh very often *resolves
    // before* an earlier still-in-flight one (mount load, or a previous WS
    // burst). Without this, whichever request happens to land last wins —
    // usually the older, slower one — silently overwriting fresh data with
    // stale data. requestIdRef makes "last dispatched" win instead of "last
    // resolved": each call claims a ticket, and only the still-current
    // ticket-holder is allowed to write state when its response arrives.
    const requestIdRef = useRef(0);

    const fetchDashboard = async () => {
        const myRequestId = ++requestIdRef.current;
        try {
            // Root requests fired together — summary and trends don't
            // depend on each other, so there's no reason to wait for one
            // before starting the other.
            const [summaryRes, trendsRes] = await Promise.all([
                axios.get(`${url}/api/finance/reports/dashboard-summary`, authHeader),
                axios.get(`${url}/api/finance/reports/dashboard-trends`, { ...authHeader, params: { months: 6 } }),
            ]);
            if (!aliveRef.current || requestIdRef.current !== myRequestId) return;

            const nextSummary = summaryRes.data.success ? summaryRes.data.data : null;
            const nextTrends = trendsRes.data.success ? trendsRes.data.data : null;
            if (nextSummary) setSummary(nextSummary);
            if (nextTrends) setTrends(nextTrends);
            setPhase1Loading(false);

            // Payables breakdown donut — every figure the "Total Payables"
            // hero KPI sums (see its own comment on the exact composition)
            // comes straight off the same summary response, so this chart
            // can never disagree with that headline number. Used to fire
            // its own separate salary/commission batch calls instead
            // (one request computing every employee/referral's figure
            // server-side) — those produced genuinely different numbers
            // than the hero KPI (a different month-scope for salary, a
            // slightly different all-time formula for commission),
            // which is exactly the "why doesn't this add up" confusion
            // reading two different "payable" figures side by side on the
            // same page caused. project-profits still needs its own batch
            // endpoint — nothing in `summary` covers it.
            const profitsRes = await axios.get(`${url}/api/finance/reports/project-profits-batch`, authHeader).catch(() => null);
            if (!aliveRef.current || requestIdRef.current !== myRequestId) return;

            const profits = profitsRes?.data?.success ? profitsRes.data.data : [];

            const nextPayablesBreakdown = {
                vendor: nextSummary?.vendorPayables || 0,
                contractor: nextSummary?.contractorPayables || 0,
                labour: nextSummary?.labourPayables || 0,
                commission: nextSummary?.commissionPayables || 0,
                salary: nextSummary?.salaryPayables || 0,
                expenses: nextSummary?.expensePayables || 0,
                tds: nextSummary?.tdsPayable || 0,
            };
            const nextProjectProfits = profits;

            setPayablesBreakdown(nextPayablesBreakdown);
            setProjectProfits(nextProjectProfits);
            setPhase2Loading(false);
            dashboardCache = {
                summary: nextSummary, trends: nextTrends,
                projectProfits: nextProjectProfits, payablesBreakdown: nextPayablesBreakdown,
            };
        } catch {
            // Dashboard degrades gracefully — a failed fetch just leaves
            // that section's empty state showing, no toast noise on load.
        } finally {
            if (aliveRef.current && requestIdRef.current === myRequestId) { setPhase1Loading(false); setPhase2Loading(false); }
        }
    };

    // State above already starts from dashboardCache (or the true/null
    // no-cache defaults) — this just kicks off the silent background
    // fetch that keeps it fresh, same as every other mount.
    useEffect(() => { fetchDashboard(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // Nearly every finance mutation feeds into this dashboard's KPIs/charts
    // somewhere (revenue, cash, payables, labour, materials...), so rather
    // than maintain a brittle allow-list of ~20 event types, any finance
    // broadcast triggers a silent background refetch — cheap since it never
    // touches the loading flags (data's already on screen) or the cache
    // structure, just quietly replaces both when the response lands.
    useFinanceWsRefresh(['*'], fetchDashboard);

    // Sized to the longest name actually on screen (after the same
    // truncation the tick itself applies), not a flat 110px regardless of
    // content — a fixed column left a large dead gap before the y-axis
    // label whenever project names were short (a bare "TEST_1" doesn't need
    // the same room as "Malhotra Enterprises — HQ..."). Clamped so a single
    // very long name can't crowd the bars out, and a single short one still
    // gets a sane minimum.
    const projectNameAxisWidth = projectProfits.length > 0
        ? Math.min(140, Math.max(50, Math.max(...projectProfits.map(p => truncateLabel(p.projectName).length)) * 6.2 + 14))
        : 60;

    const payablesData = payablesBreakdown ? [
        { name: 'Vendor', value: payablesBreakdown.vendor },
        { name: 'Contractor', value: payablesBreakdown.contractor },
        { name: 'Labour', value: payablesBreakdown.labour },
        { name: 'Commission', value: payablesBreakdown.commission },
        { name: 'Salary', value: payablesBreakdown.salary },
        { name: 'Expenses', value: payablesBreakdown.expenses },
        { name: 'TDS', value: payablesBreakdown.tds },
    ].filter(d => d.value > 0) : [];

    // One box per work type present in today's measurements (Putty, Paint,
    // etc.) — a type can span several projects/works today, so this rolls
    // those up into a single glanceable figure per type, same KpiCard style
    // as the rest of Site Activity. The detailed by-work-by-project table
    // below still has the per-row breakdown for drilling in further.
    const measurementsByType = (summary?.todaysWorkActivity || []).reduce((acc, w) => {
        acc[w.workType] = (acc[w.workType] || 0) + w.sqft;
        return acc;
    }, {});
    const measurementTypeEntries = Object.entries(measurementsByType).sort((a, b) => b[1] - a[1]);

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <h1>Finance Dashboard</h1>
                        <p className="admin-subtitle">How the business is doing right now - click any card or chart to go deeper.</p>
                    </div>
                </div>

                <KpiGrid hero>
                    <KpiCard hero loading={phase1Loading} icon={faMoneyBillTransfer} label="This Month Revenue" value={formatINR(summary?.thisMonthRevenue)}
                        sub={summary?.thisMonthRevenueBillCount > 0 ? `From ${summary.thisMonthRevenueBillCount} bill${summary.thisMonthRevenueBillCount === 1 ? '' : 's'} issued this month` : 'No bills issued this month'}
                        onClick={() => navigate('/finance/receivables')} />
                    <KpiCard hero loading={phase1Loading} icon={faArrowTrendUp} label="This Month Profit" value={formatINR(summary?.thisMonthProfit)}
                        sub={`Revenue ${formatINR(summary?.thisMonthRevenue)} − Costs ${formatINR(summary?.thisMonthTotalCost)}`}
                        onClick={() => navigate('/finance/reports?tab=project-profit')} tone={summary?.thisMonthProfit >= 0 ? 'good' : 'danger'} />
                    <KpiCard hero loading={phase1Loading} icon={faMoneyBillTransfer} label="Cash Flow This Month" value={formatINR(summary?.cashFlowThisMonth)}
                        // Real money in vs real money out this month —
                        // deliberately separate from This Month Profit
                        // above (accrual: what was billed/incurred, paid
                        // or not). A month can be accrual-profitable but
                        // cash-negative (billed a lot, collected little)
                        // or the reverse (collected old dues, paid little
                        // out) — both cards stay, answering different
                        // questions rather than one replacing the other.
                        sub={`In ${formatINR(summary?.cashInThisMonth)} − Out ${formatINR(summary?.cashOutThisMonth)}`}
                        onClick={() => navigate('/finance/bank')} tone={summary?.cashFlowThisMonth >= 0 ? 'good' : 'danger'} />
                    <KpiCard hero loading={phase1Loading} icon={faMoneyBillWave} label="This Month Miscellaneous Expense" value={formatINR(summary?.thisMonthExpense)}
                        sub={summary?.thisMonthExpenseCount > 0 ? `${summary.thisMonthExpenseCount} expense${summary.thisMonthExpenseCount === 1 ? '' : 's'} recorded this month` : undefined}
                        onClick={() => navigate('/finance/payables?tab=expenses')} />
                    <KpiCard hero loading={phase1Loading} icon={faReceipt} label="Total Miscellaneous Expense - Ongoing Projects" value={formatINR(summary?.totalExpenseToDate)} sub="All-time, excludes completed projects — misc./overhead expenses only (rent, tools, etc.); see Total Expenses below for everything" onClick={() => navigate('/finance/payables?tab=expenses')} />
                    <KpiCard hero loading={phase1Loading} icon={faArrowTrendUp} label="Total Approved Profit - Ongoing Projects" value={formatINR(summary?.totalApprovedProfitToDate)} sub="All-time, excludes completed projects" onClick={() => navigate('/finance/reports?tab=project-profit')} tone={summary?.totalApprovedProfitToDate >= 0 ? 'good' : 'danger'} />
                    <KpiCard hero loading={phase1Loading} icon={faMoneyBillTransfer} label="Total Profit Collected Till Date" value={formatINR(summary?.totalProfitCollectedTillDate)}
                        // Same cash-basis concept as Cash Flow This Month
                        // above, all-time — real money that's actually
                        // landed in the company's hands to date, every
                        // project (including completed ones, unlike the
                        // accrual figure above which excludes them).
                        sub={`Collected ${formatINR(summary?.totalCashInTillDate)} − Paid Out ${formatINR(summary?.totalCashOutTillDate)}`}
                        onClick={() => navigate('/finance/bank')} tone={summary?.totalProfitCollectedTillDate >= 0 ? 'good' : 'danger'} />
                    <KpiCard hero loading={phase1Loading} icon={faTriangleExclamation} label="Material Wastage Loss - Ongoing Projects" value={formatINR(summary?.materialWasteCostToDate)}
                        sub={[
                            summary?.materialWasteBreakdown && buildBreakdownSub([
                                ['Rejected work', summary.materialWasteBreakdown.fromRejection],
                                ['Physical waste', summary.materialWasteBreakdown.fromStock],
                            ]),
                            'All-time, excludes completed projects; already counted in Profit above',
                        ].filter(Boolean).join('  ')}
                        onClick={() => navigate('/finance/site-inventory')} tone={summary?.materialWasteCostToDate > 0 ? 'danger' : 'good'} />
                    <KpiCard hero loading={phase1Loading} icon={faMoneyBillWave} label="Total Expenses - Ongoing Projects" value={formatINR(summary?.totalExpensesAllTime)}
                        // Material vendor payments are deliberately NOT
                        // summed into the total above — Material Used
                        // (consumption value) already counts that same spend
                        // once; also adding cash paid to the vendor would
                        // double it. Vendor Payment Left (what's still owed
                        // for material purchased) is surfaced here instead,
                        // informational only, same "show it, don't blend it
                        // into a total it'd distort" treatment Client Credit
                        // Balance/Reimbursement already get elsewhere.
                        sub={`All-time, excludes completed projects — literally every expense: material used (incl. unapproved, since it can't be un-used), contractor/labour/commission/salary/labour provider/supervisor incentive cash paid, non-material vendor payments, miscellaneous expenses, and manual bank/cash out entries. Material vendor payment left: ${formatINR(summary?.vendorPayables)} (not included above — see Material Used)`}
                        tone="danger" />
                    <KpiCard hero loading={phase1Loading} icon={faFileInvoiceDollar} label="Total Receivables"
                        value={formatINR(
                            (summary?.clientReceivables || 0) + (summary?.vendorCreditTotal || 0)
                            + (summary?.contractorCreditTotal || 0) + (summary?.labourCreditTotal || 0)
                        )}
                        // Client Receivables is the main one (money clients
                        // still owe against issued bills); Vendor/Contractor/
                        // Labour Credit are the same concept from the other
                        // direction — a party who's been overpaid or
                        // over-returned-on owes the company back, a real
                        // receivable too, just never blended into
                        // vendorPayables/contractorPayables/labourPayables
                        // themselves (see those cards' own comment on why).
                        // Client Credit Balance is deliberately NOT included
                        // — that's money the client paid ahead of billing,
                        // which the company owes back via future bills, the
                        // opposite direction from every other term here.
                        sub={buildBreakdownSub([
                            ['Client', summary?.clientReceivables],
                            ['Vendor owes us', summary?.vendorCreditTotal],
                            ['Contractor owes us', summary?.contractorCreditTotal],
                            ['Labour owes us', summary?.labourCreditTotal],
                        ])}
                        onClick={() => navigate('/finance/clients')} tone="good" />
                    <KpiCard hero loading={phase1Loading} icon={faFileInvoiceDollar} label="Total Payables"
                        value={formatINR(
                            (summary?.vendorPayables || 0) + (summary?.contractorPayables || 0) + (summary?.labourPayables || 0)
                            + (summary?.commissionPayables || 0) + (summary?.salaryPayables || 0)
                            + (summary?.expensePayables || 0) + (summary?.tdsPayable || 0)
                        )}
                        // expensePayables already includes Reimbursement
                        // Payables (a subset, not a separate liability — see
                        // that card's own comment), so it's deliberately left
                        // out here to avoid double-counting. Salary is
                        // backlog + this month, same combined figure the
                        // Salaries Payable card's own headline uses — see
                        // that field's own comment for why these two used
                        // to disagree.
                        sub={buildBreakdownSub([
                            ['Vendor', summary?.vendorPayables],
                            ['Contractor', summary?.contractorPayables],
                            ['Labour', summary?.labourPayables],
                            ['Commission', summary?.commissionPayables],
                            ['Salary', summary?.salaryPayables],
                            ['Expenses', summary?.expensePayables],
                            ['TDS', summary?.tdsPayable],
                        ])}
                        tone="danger" />
                </KpiGrid>

                <KpiSectionLabel>Cash, Receivables &amp; Payables</KpiSectionLabel>
                <KpiGrid>
                    <KpiCard loading={phase1Loading} icon={faBuildingColumns} label="Cash in Bank" value={formatINR(summary?.cashInBank)}
                        sub={summary?.bankAccountsCount > 0 ? `Across ${summary.bankAccountsCount} account${summary.bankAccountsCount === 1 ? '' : 's'}` : undefined}
                        onClick={() => navigate('/finance/bank')} />
                    <KpiCard loading={phase1Loading} icon={faWallet} label="Cash in Hand" value={formatINR(summary?.cashInHand)} onClick={() => navigate('/finance/cash-book')} />
                    <KpiCard loading={phase1Loading} icon={faFileInvoiceDollar} label="Client Receivables" value={formatINR(summary?.clientReceivables)} onClick={() => navigate('/finance/clients')} tone={summary?.clientReceivables > 0 ? 'danger' : 'good'}
                        sub={summary?.clientCreditBalanceTotal > 0 ? `Client credit balance: ${formatINR(summary.clientCreditBalanceTotal)}` : undefined} />
                    <KpiCard loading={phase1Loading} icon={faCartShopping} label="Vendor Payables" value={formatINR(summary?.vendorPayables)}
                        sub={[
                            summary?.vendorPayablesBreakdown && buildBreakdownSub([
                                ['Purchased', summary.vendorPayablesBreakdown.purchases],
                                ['Returned', summary.vendorPayablesBreakdown.returns, true],
                                ['Paid', summary.vendorPayablesBreakdown.payments, true],
                            ]),
                            summary?.vendorCreditTotal > 0 ? `Vendor(s) owe us: ${formatINR(summary.vendorCreditTotal)}` : null,
                        ].filter(Boolean).join('  ') || undefined}
                        onClick={() => navigate('/finance/procurement')} tone={summary?.vendorPayables > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faHardHat} label="Contractor Payables" value={formatINR(summary?.contractorPayables)}
                        sub={[
                            summary?.contractorPayablesBreakdown && buildBreakdownSub([
                                ['Earned', summary.contractorPayablesBreakdown.earnings],
                                ['Advances', summary.contractorPayablesBreakdown.advances, true],
                                ['Deductions', summary.contractorPayablesBreakdown.deductions, true],
                                ['Direct Pay', summary.contractorPayablesBreakdown.directPaymentTotal, true],
                                ['Paid', summary.contractorPayablesBreakdown.payments, true],
                            ]),
                            summary?.contractorCreditTotal > 0 ? `Contractor(s) owe us: ${formatINR(summary.contractorCreditTotal)}` : null,
                        ].filter(Boolean).join('  ') || undefined}
                        onClick={() => navigate('/finance/contractors')} tone={summary?.contractorPayables > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faPersonDigging} label="Labour Payables" value={formatINR(summary?.labourPayables)}
                        sub={[
                            summary?.labourPayablesBreakdown && buildBreakdownSub([
                                ['Earned', summary.labourPayablesBreakdown.earnings],
                                ['Advances', summary.labourPayablesBreakdown.advances, true],
                                ['Deductions', summary.labourPayablesBreakdown.deductions, true],
                                ['Direct Pay', summary.labourPayablesBreakdown.directPaymentTotal, true],
                                ['Paid', summary.labourPayablesBreakdown.payments, true],
                            ]),
                            summary?.labourCreditTotal > 0 ? `Labourer(s) owe us: ${formatINR(summary.labourCreditTotal)}` : null,
                        ].filter(Boolean).join('  ') || undefined}
                        onClick={() => navigate('/finance/daily-labour')} tone={summary?.labourPayables > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faLock} label="Total Held" value={formatINR(summary?.totalHeld)}
                        sub={summary?.holdingBreakdown && buildBreakdownSub([
                            ['Contractor', summary.holdingBreakdown.contractor],
                            ['Labour', summary.holdingBreakdown.labour],
                        ])}
                        tone={summary?.totalHeld > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faHandHoldingDollar} label="Commission Payables" value={formatINR(summary?.commissionPayables)}
                        sub={summary?.commissionPayablesBreakdown && buildBreakdownSub([
                            ['Earned', summary.commissionPayablesBreakdown.earnings],
                            ['Paid', summary.commissionPayablesBreakdown.payments, true],
                        ])}
                        onClick={() => navigate('/finance/referrals')} tone={summary?.commissionPayables > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faUsers} label="Salaries Payable" value={formatINR(summary?.salaryPayables)}
                        sub={`This month: ${formatINR(summary?.salaryExpectedThisMonth)} · Backlog: ${formatINR(summary?.salaryOverduePayable)}`}
                        onClick={() => navigate('/finance/payables?tab=salary')} tone={summary?.salaryOverdue ? 'danger' : undefined} />
                    <KpiCard loading={phase1Loading} icon={faFileInvoice} label="Expense Payables" value={formatINR(summary?.expensePayables)}
                        sub={summary?.expensePayablesCount > 0 ? `${summary.expensePayablesCount} expense${summary.expensePayablesCount === 1 ? '' : 's'} pending or partially paid` : undefined}
                        onClick={() => navigate('/finance/payables?tab=expenses&status=unpaid')} tone={summary?.expensePayables > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faReceipt} label="Reimbursement Payables" value={formatINR(summary?.reimbursementPayables)}
                        sub={[
                            summary?.reimbursementPayablesBreakdown && buildBreakdownSub([
                                ['Claimed', summary.reimbursementPayablesBreakdown.owed],
                                ['Paid', summary.reimbursementPayablesBreakdown.paid, true],
                            ]),
                            summary?.reimbursementPayablesCount > 0 ? `${summary.reimbursementPayablesCount} employee/labourer claim${summary.reimbursementPayablesCount === 1 ? '' : 's'} still owed` : null,
                        ].filter(Boolean).join('  ') || undefined}
                        // Same destination as Expense Payables above, plus a
                        // relatedTo=reimbursement filter (ExpensesManager's
                        // defaultRelatedToFilter) — one table of every
                        // employee/labourer claim across every person at once,
                        // with the same Settle action already there for any
                        // other expense, rather than landing on Employees'
                        // directory with no person picked yet.
                        onClick={() => navigate('/finance/payables?tab=expenses&status=unpaid&relatedTo=reimbursement')} tone={summary?.reimbursementPayables > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faFileInvoiceDollar} label="TDS Payable" value={formatINR(summary?.tdsPayable)}
                        sub={`Withheld ${formatINR(summary?.tdsWithheldToDate)} − Deposited ${formatINR(summary?.tdsDepositedToDate)}`}
                        onClick={() => navigate('/finance/payments?tab=tds')} tone={summary?.tdsPayable > 0 ? 'danger' : 'good'} />
                    <KpiCard loading={phase1Loading} icon={faFileInvoiceDollar} label="GST Claimable" value={formatINR(summary?.gstClaimable)}
                        // Input Tax Credit available to claim as of this
                        // month — the CA's actual filed figure once entered
                        // (financeGstFiling), the system's own computed
                        // estimate until then, clearly flagged either way
                        // so this is never mistaken for a filed number.
                        sub={summary?.gstIsFiled ? 'As filed with the CA' : `Estimated — GST Payable: ${formatINR(summary?.gstPayable)}`}
                        onClick={() => navigate('/finance/reports?tab=ca-monthly-package')} tone="good" />
                    <KpiCard loading={phase1Loading} icon={faReceipt} label="Running Bills Ready" value={summary?.runningBillsReady ?? 0} onClick={() => navigate('/finance/receivables')} />
                </KpiGrid>

                <KpiSectionLabel>Site Activity</KpiSectionLabel>
                <KpiGrid>
                    <KpiCard loading={phase1Loading} icon={faBuilding} label="Active Projects" value={summary?.activeProjects ?? 0} onClick={() => navigate('/finance/projects')} />
                    <KpiCard loading={phase1Loading} icon={faClipboardList} label="Active Works" value={summary?.activeWorks ?? 0} onClick={() => navigate('/finance/projects')} />
                    <KpiCard loading={phase1Loading} icon={faPersonDigging} label="Personal Labour Working Today" value={summary?.labourWorkingToday ?? 0} onClick={() => navigate('/finance/daily-labour')} />
                    <KpiCard loading={phase1Loading} icon={faHardHat} label="Contractor Teams - Today" value={`${(summary?.todaysContractorMeasurementSqft || 0).toLocaleString('en-IN')} sqft`} onClick={() => navigate('/finance/contractors')} />
                    <KpiCard loading={phase1Loading} icon={faPersonDigging} label="Labour Teams - Today" value={`${(summary?.todaysLabourMeasurementSqft || 0).toLocaleString('en-IN')} sqft`} onClick={() => navigate('/finance/daily-labour')} />
                    <KpiCard loading={phase1Loading} icon={faTriangleExclamation} label="Material Low Alerts" value={summary?.materialLowAlerts ?? 0} onClick={() => navigate('/finance/site-inventory?filter=low-stock')} tone={summary?.materialLowAlerts > 0 ? 'danger' : 'good'} />
                </KpiGrid>

                {/* One box per work type measured today (Putty, Paint, TV
                    Unit...), rolled up across every project — replaces the
                    single blended "Today's Measurement" total with a
                    breakdown of what kind of work actually happened. */}
                {(phase1Loading || measurementTypeEntries.length > 0) && (
                    <KpiGrid>
                        {phase1Loading ? (
                            <KpiCard loading icon={faRulerCombined} label="Today's Measurements by Type" value="" />
                        ) : measurementTypeEntries.map(([workType, sqft]) => (
                            <KpiCard key={workType} icon={faRulerCombined} label={`${workType} - Today`} value={`${sqft.toLocaleString('en-IN')} sqft`} onClick={() => navigate('/finance/site-operations')} />
                        ))}
                    </KpiGrid>
                )}

                {/* Approved = reviewed (financeWorkReview), the same meaning
                    "Approved" has everywhere else in the app now (Contractor/
                    Labour/Commission/Labour Provider Ledgers) — cumulative,
                    not a "today" concept like the boxes above (a review
                    doesn't expire). Unapproved is its direct counterpart:
                    the same measured work, logged but not yet reviewed —
                    still a real prospective cost, just not payable yet, so
                    it gets its own section rather than being invisible
                    until someone opens a specific contractor's ledger. */}
                {(phase1Loading || (summary?.approvedByWorkType?.length > 0)) && (
                    <>
                        <KpiSectionLabel>Approved - Reviewed</KpiSectionLabel>
                        <KpiGrid>
                            {phase1Loading ? (
                                <KpiCard loading icon={faReceipt} label="Approved" value="" />
                            ) : (
                                <>
                                    <KpiCard icon={faHardHat} label="Contractor Teams - Approved" value={formatINR(summary.approvedContractorTotal)}
                                        sub={`${(summary.approvedContractorAreaSqft || 0).toLocaleString('en-IN')} sqft reviewed`}
                                        onClick={() => navigate('/finance/contractors')} tone="good" />
                                    <KpiCard icon={faPersonDigging} label="Labour Teams - Approved" value={formatINR(summary.approvedLabourTotal)}
                                        sub={`${(summary.approvedLabourAreaSqft || 0).toLocaleString('en-IN')} sqft reviewed`}
                                        onClick={() => navigate('/finance/daily-labour')} tone="good" />
                                    {summary.approvedByWorkType.map(({ workType, sqft, amount }) => (
                                        <KpiCard key={workType} icon={faReceipt} label={`${workType} - Approved`} value={`${sqft.toLocaleString('en-IN')} sqft`} sub={formatINR(amount)} onClick={() => navigate('/finance/receivables')} />
                                    ))}
                                </>
                            )}
                        </KpiGrid>
                    </>
                )}

                {(phase1Loading || (summary?.unapprovedByWorkType?.length > 0) || summary?.unapprovedCommissionTotal > 0) && (
                    <>
                        <KpiSectionLabel>Unapproved - Pending Review</KpiSectionLabel>
                        <KpiGrid>
                            {phase1Loading ? (
                                <KpiCard loading icon={faTriangleExclamation} label="Unapproved" value="" />
                            ) : (
                                <>
                                    <KpiCard icon={faHardHat} label="Contractor Payment Left - Unapproved" value={formatINR(summary.unapprovedContractorTotal)}
                                        sub={unapprovedPaidNote(
                                            summary.directPaymentContractorTotal,
                                            (summary.contractorPayablesBreakdown?.advances || 0) + (summary.contractorPayablesBreakdown?.payments || 0),
                                            'contractors',
                                            summary.contractorPayablesBreakdown?.tdsTotal || 0,
                                        )}
                                        onClick={() => navigate('/finance/contractors')} tone={summary.unapprovedContractorTotal > 0 ? 'danger' : undefined} />
                                    <KpiCard icon={faPersonDigging} label="Labour Payment Left - Unapproved" value={formatINR(summary.unapprovedLabourTotal)}
                                        sub={unapprovedPaidNote(
                                            summary.directPaymentLabourTotal,
                                            (summary.labourPayablesBreakdown?.advances || 0) + (summary.labourPayablesBreakdown?.payments || 0),
                                            'labour',
                                            summary.labourPayablesBreakdown?.tdsTotal || 0,
                                        )}
                                        onClick={() => navigate('/finance/daily-labour')} tone={summary.unapprovedLabourTotal > 0 ? 'danger' : undefined} />
                                    <KpiCard icon={faHandHoldingDollar} label="Commission - Unapproved" value={formatINR(summary.unapprovedCommissionTotal)} onClick={() => navigate('/finance/referrals')} tone={summary.unapprovedCommissionTotal > 0 ? 'danger' : undefined} />
                                    <KpiCard icon={faArrowTrendUp} label="Profit - Unapproved" value={formatINR(summary.unapprovedProfitTotal)}
                                        sub={buildBreakdownSub([
                                            ['Revenue once approved', summary.unapprovedRevenueTotal],
                                            ['Material', summary.unapprovedMaterialTotal, true],
                                            ['Contractor', summary.unapprovedContractorTotal, true],
                                            ['Labour', summary.unapprovedLabourTotal, true],
                                            ['Commission', summary.unapprovedCommissionTotal, true],
                                        ])}
                                        onClick={() => navigate('/finance/receivables')} tone={summary.unapprovedProfitTotal >= 0 ? 'good' : 'danger'} />
                                    <KpiCard icon={faArrowTrendUp} label="Total Projected Profit" value={formatINR(summary.totalProjectedProfit)}
                                        sub="Approved (ongoing projects) + Unapproved (all), once everything currently logged clears review"
                                        onClick={() => navigate('/finance/receivables')} tone={summary.totalProjectedProfit >= 0 ? 'good' : 'danger'} />
                                    {(summary.directPaymentContractorTotal + summary.directPaymentLabourTotal) > 0 && (
                                        <KpiCard icon={faHandHoldingDollar} label="Direct Payments (Client → Workers)"
                                            value={formatINR(summary.directPaymentContractorTotal + summary.directPaymentLabourTotal)}
                                            sub="An advance, not tied to specific sqft — a flat reduction against each worker's Balance Payable"
                                            onClick={() => navigate('/finance/payables?tab=client-direct-payments')}
                                        />
                                    )}
                                    {summary.unapprovedByWorkType.map(({ workType, sqft, amount }) => (
                                        <KpiCard key={workType} icon={faTriangleExclamation} label={`${workType} - Unapproved`} value={`${sqft.toLocaleString('en-IN')} sqft`} sub={`Revenue once approved: ${formatINR(amount)}`} onClick={() => navigate('/finance/receivables')} tone={amount > 0 ? 'danger' : undefined} />
                                    ))}
                                </>
                            )}
                        </KpiGrid>
                    </>
                )}

                <ChartGrid>
                    <ChartCard title="Revenue vs Cost - last 6 months">
                        {phase1Loading ? <ChartSkeleton /> : trends?.revenueVsCost?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <ComposedChart data={trends.revenueVsCost}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} activeBar={false} />
                                    <Line type="monotone" dataKey="cost" name="Cost" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 3 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart />}
                    </ChartCard>

                    <ChartCard title="Cash Flow - last 30 days">
                        {phase1Loading ? <ChartSkeleton /> : trends?.cashFlowSeries?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={trends.cashFlowSeries}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis dataKey="bucket" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Area type="monotone" dataKey="in" name="In" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.15} />
                                    <Area type="monotone" dataKey="out" name="Out" stroke={CHART_COLORS[2]} fill={CHART_COLORS[2]} fillOpacity={0.15} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart />}
                    </ChartCard>

                    <ChartCard title="Project Profitability">
                        {phase2Loading ? <ChartSkeleton /> : projectProfits.length > 0 ? (
                            <ResponsiveContainer width="100%" height={Math.max(260, projectProfits.length * 38)}>
                                <ComposedChart data={projectProfits} layout="vertical" margin={{ left: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                    <YAxis
                                        type="category" dataKey="projectName" width={projectNameAxisWidth}
                                        tick={<ProjectNameTick />} interval={0}
                                    />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                    <Bar
                                        dataKey="profit" name="Profit" radius={[0, 4, 4, 0]}
                                        onClick={(d) => navigate(`/finance/projects/${d.projectId}`)}
                                        style={{ cursor: 'pointer' }}
                                        activeBar={false}
                                    >
                                        {projectProfits.map((p, i) => <Cell key={i} fill={p.profit >= 0 ? CHART_COLORS[0] : CHART_COLORS[2]} />)}
                                    </Bar>
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart text="No active projects yet." />}
                    </ChartCard>

                    <ChartCard title="Payables Breakdown">
                        {phase2Loading ? <ChartSkeleton /> : payablesData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie data={payablesData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                                        {payablesData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart text="Nothing payable right now." />}
                    </ChartCard>
                </ChartGrid>

                <ActivityCard
                    title="Recent Activity"
                    loading={phase1Loading}
                    items={summary?.recentActivities}
                    onViewAll={() => navigate('/finance/activity')}
                />
            </div>
        </div>
    );
};

export default FinanceHome;
