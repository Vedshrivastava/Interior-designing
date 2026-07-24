import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
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
import { KpiCard, KpiGrid, ChartCard, ChartGrid, EmptyChart, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
import '../../styles/list.css';
import '../../styles/dashboard.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const BILLABLE_CONTRACT_TYPES = ['with_material', 'without_material', 'advance'];

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

    const fetchOverview = useCallback(async () => {
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
            if (profitRes.data.success) setProfit(profitRes.data.data);
            if (materialRes.data.success) setMaterials(materialRes.data.data);
            if (purchasesRes.data.success) {
                const byVendor = new Map();
                for (const p of purchasesRes.data.data) {
                    if (!p.vendorId) continue;
                    const key = p.vendorId._id || p.vendorId;
                    if (!byVendor.has(key)) byVendor.set(key, { vendorId: key, vendorName: p.vendorId.name || '-', totalPurchased: 0 });
                    byVendor.get(key).totalPurchased += p.totalAmount;
                }
                setVendors([...byVendor.values()]);
            }
            if (receivableRes?.data.success) setReceivable(receivableRes.data.data);
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

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (!profit) return <div className="admin-empty-state"><p>Unable to load project profitability.</p></div>;

    const costBreakdown = [
        { name: 'Material', value: profit.materialCost },
        { name: 'Contractor', value: profit.contractorCost },
        { name: 'Commission', value: profit.commissionCost },
        { name: 'Labour', value: profit.labourCost },
        { name: 'Other Expenses', value: profit.otherExpenses },
    ].filter(d => d.value > 0);

    return (
        <div>
            <KpiGrid>
                <KpiCard label="Revenue" value={formatINR(profit.revenue)} />
                <KpiCard label="Material Cost" value={formatINR(profit.materialCost)} />
                <KpiCard label="Contractor Cost" value={formatINR(profit.contractorCost)} />
                <KpiCard label="Commission Cost" value={formatINR(profit.commissionCost)} />
                <KpiCard label="Labour Cost" value={formatINR(profit.labourCost)} />
                <KpiCard label="Other Expenses" value={formatINR(profit.otherExpenses)} />
                <KpiCard label="Profit" value={formatINR(profit.profit)} tone={profit.profit >= 0 ? 'good' : 'danger'} />
                <KpiCard label="Margin %" value={`${Math.round(profit.marginPercent * 10) / 10}%`} tone={profit.marginPercent >= 0 ? 'good' : 'danger'} />
            </KpiGrid>

            {(profit.unapprovedContractorCost > 0 || profit.unapprovedLabourCost > 0 || profit.unapprovedCommissionCost > 0) && (
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
                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: "1fr" }}><b>Receivable Status</b></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: receivable.directPaymentCredits > 0 ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr' }}>
                        <p>Billed: {formatINR(receivable.issuedTotal)}</p>
                        <p>Received: {formatINR(receivable.receivedTotal)}</p>
                        {receivable.directPaymentCredits > 0 && <p>Client Direct Payment Credits: {formatINR(receivable.directPaymentCredits)}</p>}
                        <p style={{ color: receivable.balance > 0 ? '#c0392b' : 'var(--moss)' }}>Outstanding: {formatINR(receivable.balance)}</p>
                    </div>
                </div>
            )}

            {materials.length > 0 && (
                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1.1fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr 1fr' }}>
                        <b>Material</b><b>Dumped</b><b>Consumed</b><b>Wasted</b><b>Current Stock</b><b>Avg Cost</b><b>Cost/Sqft</b>
                    </div>
                    {materials.map(m => (
                        <div key={m.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.1fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr 1fr' }}>
                            <p>{m.materialName}</p>
                            <p>{m.totalDumped} {m.unit}</p>
                            <p>{m.totalConsumed} {m.unit}</p>
                            <p>{m.totalWasted} {m.unit}</p>
                            <p>{m.currentStock} {m.unit}</p>
                            <p>{formatINR(m.weightedAverageCost)}{m.unit ? `/${m.unit}` : ''}</p>
                            <p>{m.areaCoveredSqft > 0 ? `₹${m.costPerSqft.toFixed(2)}/sqft` : '—'}</p>
                        </div>
                    ))}
                </div>
            )}

            {vendors.length > 0 && (
                <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
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
    const [advanceNotes, setAdvanceNotes] = useState('');
    const [advancePaymentMode, setAdvancePaymentMode] = useState('');
    const [advanceBankAccountId, setAdvanceBankAccountId] = useState('');
    const [advanceUtrNumber, setAdvanceUtrNumber] = useState('');
    const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
    const [paymentModes, setPaymentModes] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
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
        fetchPaymentModes();
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
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
            await fetchProject();
        } catch (err) {
            if (err.response?.data?.blockers) setCompletionBlockers(err.response.data.blockers);
            else toast.error(err.response?.data?.message || 'Error completing project');
        } finally { setCompleting(false); }
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
                        <div className="list-table finance-table" style={{ marginBottom: '24px' }}>
                            <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Site Location</b></p><p>{project.siteLocation || '-'}</p></div>
                            <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Start Date</b></p><p>{project.startDate ? new Date(project.startDate).toLocaleDateString() : '-'}</p></div>
                            <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Estimated Area</b></p><p>{project.estimatedAreaSqft || 0} sqft</p></div>
                            <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Material Tracking</b></p><p>{project.materialTrackingEnabled ? 'Enabled' : 'Disabled'}</p></div>
                            {project.contractType === 'advance' && (
                                <>
                                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Total Estimated Cost</b></p><p>₹{project.totalEstimatedCost?.toLocaleString('en-IN')}</p></div>
                                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Advance Amount</b></p><p>₹{project.advanceAmount?.toLocaleString('en-IN')}</p></div>
                                    {project.referralId && (
                                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                            <p><b>Referral Commission</b></p>
                                            <div className="add-product-name" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', margin: 0 }}>
                                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={commissionInput} onChange={e => setCommissionInput(e.target.value)} style={{ maxWidth: '140px' }} />
                                                {Number(commissionInput) !== (project.referralCommissionAmount || 0) && (
                                                    <button type="button" className="add-point-btn" disabled={savingCommission} onClick={saveCommission}>
                                                        {savingCommission ? 'Saving…' : 'Save'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                        <p><b>Advance Invoiced</b></p>
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
                                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                        <p><b>Advance Received</b></p>
                                        <div>
                                            {project.advanceReceived ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                            <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Notes</b></p><p>{project.notes || '-'}</p></div>
                        </div>
                        <ProjectOverviewTab url={url} projectId={id} contractType={project.contractType} onViewWorks={() => setActiveTab('works')} />
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
                                />
                            </div>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Received Into (Your Bank Account)</p>
                                    <StyledSelect
                                        value={advanceBankAccountId} onChange={setAdvanceBankAccountId} placeholder="Cash, no bank account"
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
        </div>
    );
};

export default ProjectDetail;
