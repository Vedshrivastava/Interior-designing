import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import QuickAddPicker from '../../components/finance/QuickAddPicker';
import LabourMeasurementsManager from '../../components/finance/LabourMeasurementsManager';
import LabourWorksView from '../../components/finance/LabourWorksView';
import LabourWorkerMeasurementsView from '../../components/finance/LabourWorkerMeasurementsView';
import LabourLedgerView from '../../components/finance/LabourLedgerView';
import LabourProviderLedgerView from '../../components/finance/LabourProviderLedgerView';
import ExpensesManager from '../../components/finance/ExpensesManager';
import PersonDocumentsView from '../../components/finance/PersonDocumentsView';
import { ChartCard, ChartGrid, EmptyChart, ChartSkeleton, ChartTooltip, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
import '../../styles/list.css';
import '../../styles/dashboard.css';

// Same dashboardCache pattern as ContractorsPage.jsx's own
// contractorsOverviewCache — this Overview always shows the same
// company-wide aggregate (no picker scoping it), so a single
// module-level cache is enough.
let labourersOverviewCache = null;

/* Direct labour-side mirror of ContractorsOverviewTab (ContractorsPage.jsx)
   — same table shape (Total/Approved/Advances/Deductions/Payments/Held/
   Balance Payable) and the same two charts, backed by
   /api/finance/reports/labourers-summary instead of contractors-summary.
   Clicking a labourer row jumps straight into the Ledger tab, same
   destination the picker already leads to. */
const LabourersOverviewTab = ({ url, onSelectLabourer }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [summary, setSummary] = useState(labourersOverviewCache);
    const [loading, setLoading] = useState(!labourersOverviewCache);

    const fetchSummary = () => {
        axios.get(`${url}/api/finance/reports/labourers-summary`, authHeader)
            .then(res => { if (res.data.success) { setSummary(res.data.data); labourersOverviewCache = res.data.data; } })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!labourersOverviewCache) setLoading(true);
        fetchSummary();
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh([
        'financeLabourersChanged', 'financeWorkLabourAssignmentsChanged', 'financeWorksChanged',
        'financeLabourRatesChanged', 'financeLabourMeasurementsChanged', 'financeLabourLedgerChanged',
    ], fetchSummary);

    const labourers = summary?.labourers || [];
    const payableData = labourers.filter(l => l.balancePayable !== 0).map(l => ({ name: l.labourerName, balancePayable: l.balancePayable, labourerId: l.labourerId }));

    // Cost-per-sqft grouped by work type, one series per work type so
    // labourers are only ever compared within the same work type.
    const workTypes = [...new Set((summary?.costPerSqft || []).flatMap(l => l.byWorkType.map(w => w.workType)))];
    const costPerSqftData = (summary?.costPerSqft || [])
        .filter(l => l.byWorkType.length > 0)
        .map(l => {
            const row = { name: l.labourerName };
            for (const wt of l.byWorkType) row[wt.workType] = wt.costPerSqft;
            return row;
        });

    return (
        <div>
            {(loading || labourers.length > 0) && (
                <>
                    <ChartGrid>
                        <ChartCard title="Balance Payable per Labourer">
                            {loading ? <ChartSkeleton /> : payableData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={payableData} layout="vertical" margin={{ left: 24 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                        <Bar dataKey="balancePayable" name="Balance Payable" radius={[0, 4, 4, 0]} activeBar={false} onClick={(d) => onSelectLabourer(d.labourerId)} style={{ cursor: 'pointer' }}>
                                            {payableData.map((_, i) => <Cell key={i} fill={CHART_COLORS[0]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart text="Nothing payable right now." />}
                        </ChartCard>
                        <ChartCard title="Cost/Sqft by Work Type">
                            {loading ? <ChartSkeleton /> : costPerSqftData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={costPerSqftData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        {/* formatINR rounds to whole rupees — fine for real
                                            money totals, but this is a per-sqft rate (e.g.
                                            ₹5.20), where that rounding silently drops the
                                            decimal. */}
                                        <Tooltip content={<ChartTooltip valueFormatter={(v) => `₹${(v || 0).toFixed(2)}/sqft`} />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                        {workTypes.map((wt, i) => <Bar key={wt} dataKey={wt} name={wt} fill={CHART_COLORS[i % CHART_COLORS.length]} activeBar={false} />)}
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart text="No completed work yet." />}
                        </ChartCard>
                    </ChartGrid>

                    <div className="dash-chart-card con-ov-card" style={{ marginBottom: '24px' }}>
                        <div className="con-ov-row con-ov-header">
                            <b className="con-ov-name">Labourer</b>
                            <b className="con-ov-total">Total</b>
                            <b className="con-ov-approved">Approved</b>
                            <b className="con-ov-advances">Advances</b>
                            <b className="con-ov-deductions">Deductions</b>
                            <b className="con-ov-payments">Payments</b>
                            <b className="con-ov-held">Held</b>
                            <b className="con-ov-balance">Balance Payable</b>
                        </div>
                        {labourers.map(l => (
                            <div key={l.labourerId} className="con-ov-row">
                                <p className="con-ov-name cursor" onClick={() => onSelectLabourer(l.labourerId)}>{l.labourerName}</p>
                                <p className="con-ov-total"><span className="pq-group-label">Total</span>{formatINR(l.totalAmount)}</p>
                                <p className="con-ov-approved" style={{ color: l.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}><span className="pq-group-label">Approved</span>{l.earnings > 0 ? formatINR(l.earnings) : 'Unapproved'}</p>
                                <p className="con-ov-advances"><span className="pq-group-label">Advances</span>{formatINR(l.advances)}</p>
                                <p className="con-ov-deductions"><span className="pq-group-label">Deductions</span>{formatINR(l.deductions)}</p>
                                <p className="con-ov-payments"><span className="pq-group-label">Payments</span>{formatINR(l.payments)}</p>
                                <p className="con-ov-held" style={{ color: l.holdingTotal > 0 ? '#c0392b' : 'var(--text-lt)' }}><span className="pq-group-label">Held</span>{formatINR(l.holdingTotal || 0)}</p>
                                <p className="con-ov-balance" style={{ color: l.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}><span className="pq-group-label">Balance Payable</span>{formatINR(l.balancePayable)}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
            <MasterCrudTable url={url} resourceKey="labourers" cardTitle="Labourers" />
        </div>
    );
};

const TABS = [
    { key: 'entries',      label: 'All Entries' },
    { key: 'overview',     label: 'Overview' },
    { key: 'projects',     label: 'Projects' },
    { key: 'works',        label: 'Works' },
    { key: 'measurements', label: 'Measurements' },
    { key: 'ledger',       label: 'Ledger' },
    { key: 'reimbursements', label: 'Reimbursements' },
    { key: 'labourProviders', label: 'Labour Providers' },
    { key: 'providerLedger', label: 'Labour Provider Ledger' },
    { key: 'documents',    label: 'Documents' },
];

const LABOURER_SCOPED_TABS = ['projects', 'works', 'measurements', 'ledger', 'reimbursements', 'documents'];

/* Same "picker on the same page" pattern as ContractorPicker. */
const LabourerPicker = ({ url, selectedLabourerId, onChange }) => (
    <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
        <p>Labourer</p>
        <QuickAddPicker url={url} resourceKey="labourers" value={selectedLabourerId} onChange={onChange} placeholder="Select labourer…" />
    </div>
);

/* Provider Ledger is scoped by the provider itself, not by labourer — a
   provider's cut aggregates across every labourer connected to them — so
   it gets its own picker instead of reusing LabourerPicker/
   selectedLabourerId. A labour provider is its own collection
   (financeLabourProvider), not a vendor. */
const LabourProviderPicker = ({ url, selectedProviderId, onChange }) => (
    <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
        <p>Labour Provider</p>
        <QuickAddPicker url={url} resourceKey="labourProviders" value={selectedProviderId} onChange={onChange} placeholder="Select labour provider…" />
    </div>
);

/* Mirrors ContractorProjectsTab — derived from the labour ledger's own
   works[] (projectId/projectName per row), deduped client-side. */
const LabourerProjectsTab = ({ url, labourerId }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!labourerId) { setLoading(false); return; }
        setLoading(true);
        axios.get(`${url}/api/finance/labourer-ledger/${labourerId}/ledger`, authHeader)
            .then(res => {
                if (!res.data.success) return;
                const byProject = new Map();
                for (const w of res.data.data.works) {
                    const key = w.projectId.toString();
                    if (!byProject.has(key)) byProject.set(key, { projectId: w.projectId, projectName: w.projectName, workTypes: new Set() });
                    byProject.get(key).workTypes.add(w.workType);
                }
                setProjects([...byProject.values()].map(p => ({ ...p, workTypes: [...p.workTypes] })));
            })
            .catch(() => toast.error('Error fetching projects'))
            .finally(() => setLoading(false));
    }, [url, labourerId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!labourerId) return <div className="admin-empty-state"><p>Select a labourer to view their projects.</p></div>;
    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (projects.length === 0) return <div className="admin-empty-state"><p>No projects for this labourer yet.</p></div>;

    return (
        <div className="dash-chart-card lap-card">
            <div className="lap-row lap-header">
                <b className="lap-name">Project</b>
                <b className="lap-types">Work Types</b>
            </div>
            {projects.map(p => (
                <div key={p.projectId} className="lap-row">
                    <p className="lap-name cursor" onClick={() => navigate(`/finance/projects/${p.projectId}`)}>{p.projectName}</p>
                    <p className="lap-types">{p.workTypes.join(', ')}</p>
                </div>
            ))}
        </div>
    );
};

/*
 * Labourers — mirrors Contractors' page structure (picker + Overview/
 * Projects/Works/Measurements/Ledger/Documents), adapted for individual
 * labourers instead of vendors: no Settlements/Bills tabs (labourers
 * aren't billed to clients), and "All Entries" stays as its own
 * unscoped tab — the global cross-labourer entry form + list this page
 * always had, same LabourMeasurementsManager component a project's own
 * Labour tab reuses.
 */
const DailyLabourPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);
    const [selectedLabourerId, setSelectedLabourerId] = useState('');
    const [selectedProviderId, setSelectedProviderId] = useState('');

    return (
        <FinanceTabShell
            label="Labourers"
            subtitle="Individual labourers hired directly by the company, paid per sqft; not a day rate."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'entries' && <LabourMeasurementsManager url={url} />}
            {activeTab === 'overview' && (
                <LabourersOverviewTab url={url} onSelectLabourer={(labourerId) => { setSelectedLabourerId(labourerId); setActiveTab('ledger'); }} />
            )}

            {LABOURER_SCOPED_TABS.includes(activeTab) && (
                <LabourerPicker url={url} selectedLabourerId={selectedLabourerId} onChange={setSelectedLabourerId} />
            )}
            {activeTab === 'projects' && <LabourerProjectsTab url={url} labourerId={selectedLabourerId} />}
            {activeTab === 'works' && (
                selectedLabourerId ? <LabourWorksView url={url} labourerId={selectedLabourerId} /> : <div className="admin-empty-state"><p>Select a labourer to view their works.</p></div>
            )}
            {activeTab === 'measurements' && (
                selectedLabourerId ? <LabourWorkerMeasurementsView url={url} labourerId={selectedLabourerId} /> : <div className="admin-empty-state"><p>Select a labourer to view their measurements.</p></div>
            )}
            {activeTab === 'ledger' && (
                selectedLabourerId ? <LabourLedgerView url={url} labourerId={selectedLabourerId} /> : <div className="admin-empty-state"><p>Select a labourer to view their ledger.</p></div>
            )}
            {activeTab === 'reimbursements' && (
                selectedLabourerId ? (
                    <ExpensesManager
                        url={url}
                        fixedRelatedTo={{
                            type: 'financeLabourer', id: selectedLabourerId, label: 'Reimbursements',
                            subtitle: 'Expenses this labourer paid out of pocket — a bill/receipt is required for each. Record as pending, then Settle once they\'ve been paid back.',
                        }}
                    />
                ) : <div className="admin-empty-state"><p>Select a labourer to view their reimbursements.</p></div>
            )}
            {activeTab === 'labourProviders' && <MasterCrudTable url={url} resourceKey="labourProviders" cardTitle="Labour Providers" />}
            {activeTab === 'providerLedger' && (
                <>
                    <LabourProviderPicker url={url} selectedProviderId={selectedProviderId} onChange={setSelectedProviderId} />
                    {selectedProviderId
                        ? <LabourProviderLedgerView url={url} labourProviderId={selectedProviderId} />
                        : <div className="admin-empty-state"><p>Select a labour provider to view their ledger.</p></div>}
                </>
            )}
            {activeTab === 'documents' && <PersonDocumentsView url={url} resourceKey="labourers" entityId={selectedLabourerId} entityLabel="labourer" />}
        </FinanceTabShell>
    );
};

export default DailyLabourPage;
