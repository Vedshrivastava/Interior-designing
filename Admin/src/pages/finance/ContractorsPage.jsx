import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import QuickAddPicker from '../../components/finance/QuickAddPicker';
import ContractorWorksView from '../../components/finance/ContractorWorksView';
import ContractorMeasurementsView from '../../components/finance/ContractorMeasurementsView';
import ContractorLedgerView from '../../components/finance/ContractorLedgerView';
import PersonDocumentsView from '../../components/finance/PersonDocumentsView';
import { ChartCard, ChartGrid, EmptyChart, ChartSkeleton, ChartTooltip, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
import '../../styles/list.css';
import '../../styles/dashboard.css';

const TABS = [
    { key: 'overview',     label: 'Overview' },
    { key: 'projects',     label: 'Projects' },
    { key: 'works',        label: 'Works' },
    { key: 'measurements', label: 'Measurements' },
    { key: 'ledger',       label: 'Ledger' },
    { key: 'bills',        label: 'Bills' },
    { key: 'documents',    label: 'Documents' },
];

const IS_CONTRACTOR = (v) => v.vendorType === 'labour_contractor';
const VENDOR_SCOPED_TABS = ['projects', 'works', 'measurements', 'ledger', 'documents'];

// Same dashboardCache pattern as FinanceHome.jsx — the Overview tab always
// shows the same company-wide aggregate (no picker scoping it), so a
// single module-level cache is enough.
let contractorsOverviewCache = null;

/* Projects this contractor is actually on — derived from their teams' Works,
   not the old single project-level field. Reuses the contractor ledger
   endpoint (no projectId param → every work across every project this
   contractor is on) rather than a separate endpoint — its `works` array
   already carries projectId/projectName per row; dedupe client-side. */
const ContractorProjectsTab = ({ url, vendorId }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!vendorId) { setLoading(false); return; }
        setLoading(true);
        axios.get(`${url}/api/finance/contractors/${vendorId}/ledger`, authHeader)
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
    }, [url, vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!vendorId) return <div className="admin-empty-state"><p>Select a contractor to view their projects.</p></div>;
    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (projects.length === 0) return <div className="admin-empty-state"><p>No projects for this contractor yet.</p></div>;

    return (
        <div className="dash-chart-card con-proj-card">
            <div className="con-proj-row con-proj-header">
                <b className="con-proj-name">Project</b>
                <b className="con-proj-types">Work Types</b>
            </div>
            {projects.map(p => (
                <div key={p.projectId} className="con-proj-row">
                    <p className="con-proj-name cursor" onClick={() => navigate(`/finance/projects/${p.projectId}`)}>{p.projectName}</p>
                    <p className="con-proj-types">{p.workTypes.join(', ')}</p>
                </div>
            ))}
        </div>
    );
};

/* Shared by Works / Measurements / Ledger / Settlements — all four need one
   contractor picked before they mean anything, same picker pattern used by
   Site Inventory / Receipts / unscoped Measurements elsewhere. */
const ContractorPicker = ({ url, selectedVendorId, onChange }) => (
    <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
        <p>Contractor</p>
        <QuickAddPicker url={url} resourceKey="vendors" value={selectedVendorId} onChange={onChange}
            filter={IS_CONTRACTOR} presetValues={{ vendorType: 'labour_contractor' }} placeholder="Select contractor…" />
    </div>
);

/* Tier-1 mini-dashboard for the Overview tab — payable-per-contractor and
   cost-per-sqft grouped by work type (never blended across types — a
   Putty rate isn't comparable to a Paint rate), on top of the existing
   contractor-filtered CRUD table. Clicking a contractor row jumps straight
   into the Ledger tab, same destination the picker already leads to. */
const ContractorsOverviewTab = ({ url, onSelectContractor }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [summary, setSummary] = useState(contractorsOverviewCache);
    const [loading, setLoading] = useState(!contractorsOverviewCache);

    const fetchSummary = () => {
        axios.get(`${url}/api/finance/reports/contractors-summary`, authHeader)
            .then(res => { if (res.data.success) { setSummary(res.data.data); contractorsOverviewCache = res.data.data; } })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!contractorsOverviewCache) setLoading(true);
        fetchSummary();
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh([
        'financeVendorsChanged', 'financeWorkContractorAssignmentsChanged', 'financeWorksChanged',
        'financeContractorRatesChanged', 'financeMeasurementsChanged', 'financeContractorLedgerChanged',
    ], fetchSummary);

    const contractors = summary?.contractors || [];
    const payableData = contractors.filter(c => c.balancePayable !== 0).map(c => ({ name: c.vendorName, balancePayable: c.balancePayable, vendorId: c.vendorId }));

    // Cost-per-sqft grouped by work type, one series per work type so
    // contractors are only ever compared within the same work type.
    const workTypes = [...new Set((summary?.costPerSqft || []).flatMap(c => c.byWorkType.map(w => w.workType)))];
    const costPerSqftData = (summary?.costPerSqft || [])
        .filter(c => c.byWorkType.length > 0)
        .map(c => {
            const row = { name: c.vendorName };
            for (const wt of c.byWorkType) row[wt.workType] = wt.costPerSqft;
            return row;
        });

    return (
        <div>
            {(loading || contractors.length > 0) && (
                <>
                    <ChartGrid>
                        <ChartCard title="Balance Payable per Contractor">
                            {loading ? <ChartSkeleton /> : payableData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={payableData} layout="vertical" margin={{ left: 24 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                        <Bar dataKey="balancePayable" name="Balance Payable" radius={[0, 4, 4, 0]} activeBar={false} onClick={(d) => onSelectContractor(d.vendorId)} style={{ cursor: 'pointer' }}>
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
                            <b className="con-ov-name">Contractor</b>
                            <b className="con-ov-total">Total</b>
                            <b className="con-ov-approved">Approved</b>
                            <b className="con-ov-advances">Advances</b>
                            <b className="con-ov-deductions">Deductions</b>
                            <b className="con-ov-payments">Payments</b>
                            <b className="con-ov-held">Held</b>
                            <b className="con-ov-balance">Balance Payable</b>
                        </div>
                        {contractors.map(c => (
                            <div key={c.vendorId} className="con-ov-row">
                                <p className="con-ov-name cursor" onClick={() => onSelectContractor(c.vendorId)}>{c.vendorName}</p>
                                <p className="con-ov-total"><span className="pq-group-label">Total</span>{formatINR(c.totalAmount)}</p>
                                <p className="con-ov-approved" style={{ color: c.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}><span className="pq-group-label">Approved</span>{c.earnings > 0 ? formatINR(c.earnings) : 'Unapproved'}</p>
                                <p className="con-ov-advances"><span className="pq-group-label">Advances</span>{formatINR(c.advances)}</p>
                                <p className="con-ov-deductions"><span className="pq-group-label">Deductions</span>{formatINR(c.deductions)}</p>
                                <p className="con-ov-payments"><span className="pq-group-label">Payments</span>{formatINR(c.payments)}</p>
                                <p className="con-ov-held" style={{ color: c.holdingTotal > 0 ? '#c0392b' : 'var(--text-lt)' }}><span className="pq-group-label">Held</span>{formatINR(c.holdingTotal || 0)}</p>
                                <p className="con-ov-balance" style={{ color: c.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}><span className="pq-group-label">Balance Payable</span>{formatINR(c.balancePayable)}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
            <MasterCrudTable url={url} resourceKey="vendors" filter={IS_CONTRACTOR} />
        </div>
    );
};

/* Contractors are financeVendor rows with vendorType 'labour_contractor' —
   same data/CRUD as Procurement's Vendors tab, filtered the other way.
   Ledger and Settlements render the exact same view (Settlements was
   reserved for it) — earnings resolved from this contractor's teams'
   financeWork rows, advances/deductions/payments, and the computed
   Balance Payable. Nothing here is stored — see
   controllers/financeContractorLedger.js. */
const ContractorsPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);
    const [selectedVendorId, setSelectedVendorId] = useState('');

    return (
        <FinanceTabShell
            label="Contractors"
            subtitle="Labour contractors: vendors with type Labour Contractor."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'overview' && (
                <ContractorsOverviewTab url={url} onSelectContractor={(vendorId) => { setSelectedVendorId(vendorId); setActiveTab('ledger'); }} />
            )}
            {VENDOR_SCOPED_TABS.includes(activeTab) && (
                <ContractorPicker url={url} selectedVendorId={selectedVendorId} onChange={setSelectedVendorId} />
            )}
            {activeTab === 'projects' && <ContractorProjectsTab url={url} vendorId={selectedVendorId} />}
            {activeTab === 'works' && (
                selectedVendorId ? <ContractorWorksView url={url} vendorId={selectedVendorId} /> : <div className="admin-empty-state"><p>Select a contractor to view their works.</p></div>
            )}
            {activeTab === 'measurements' && (
                selectedVendorId ? <ContractorMeasurementsView url={url} vendorId={selectedVendorId} /> : <div className="admin-empty-state"><p>Select a contractor to view their measurements.</p></div>
            )}
            {activeTab === 'ledger' && (
                selectedVendorId ? <ContractorLedgerView url={url} vendorId={selectedVendorId} /> : <div className="admin-empty-state"><p>Select a contractor to view their ledger.</p></div>
            )}

            {activeTab === 'bills' && <PlaceholderTab text="Bills raised by/for this contractor." />}
            {activeTab === 'documents' && <PersonDocumentsView url={url} resourceKey="vendors" entityId={selectedVendorId} entityLabel="contractor" />}
        </FinanceTabShell>
    );
};

export default ContractorsPage;
