import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import RunningBillsManager from '../../components/finance/RunningBillsManager';
import WorkReviewPanel from '../../components/finance/WorkReviewPanel';
import StyledSelect from '../../components/finance/StyledSelect';

const TABS = [
    { key: 'review',   label: 'Work Review' },
    { key: 'running',  label: 'Running Bills' },
    { key: 'pending',  label: 'Pending Bills' },
    { key: 'approved', label: 'Approved Bills' },
    { key: 'receipts', label: 'Pending Receipts' },
];
const STATUS_FILTER = { running: undefined, pending: 'draft', approved: 'issued' };

// Same dashboardCache pattern as FinanceHome.jsx — Pending Receipts is a
// global, cross-project rollup (not scoped by the page's own project
// picker), so a single module-level cache is enough.
let pendingReceiptsCache = null;

const ProjectPicker = ({ url, selectedProjectId, onChange }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
            <p>Project</p>
            <StyledSelect
                value={selectedProjectId}
                onChange={onChange}
                placeholder="Select project…"
                options={projects.map(p => ({ value: p._id, label: p.name }))}
            />
        </div>
    );
};

// The global, cross-project view — every billable project with at least
// one issued bill and a positive outstanding balance, oldest bill first.
// No true "overdue" flag: there's no due-date field on a project to base
// one on, so this is the closest honest proxy, not a guess dressed up as one.
const PendingReceiptsTab = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [rows, setRows] = useState(pendingReceiptsCache || []);
    const [loading, setLoading] = useState(!pendingReceiptsCache);

    const fetchRows = () => {
        axios.get(`${url}/api/finance/receivables/summary`, authHeader)
            .then(res => { if (res.data.success) { setRows(res.data.data); pendingReceiptsCache = res.data.data; } })
            .catch(() => toast.error('Error fetching receivables'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchRows(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh(['financeProjectsChanged', 'financeRunningBillsChanged', 'financeReceiptsChanged'], fetchRows);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (rows.length === 0) return <div className="admin-empty-state"><p>Nothing outstanding: every issued bill is fully received.</p></div>;

    return (
        <div className="dash-chart-card prt-card">
            <div className="prt-row prt-header">
                <b className="prt-project">Project</b>
                <b className="prt-client">Client</b>
                <b className="prt-issued">Issued</b>
                <b className="prt-received">Received</b>
                <b className="prt-outstanding">Outstanding</b>
            </div>
            {rows.map(r => (
                <div key={r.projectId} className="prt-row">
                    <p className="prt-project" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/projects/${r.projectId}`)}>{r.projectName}</p>
                    <p className="prt-client"><span className="pq-group-label">Client</span>{r.clientName || '-'}</p>
                    <p className="prt-issued"><span className="pq-group-label">Issued</span>₹{r.issuedTotal.toLocaleString('en-IN')}</p>
                    <p className="prt-received"><span className="pq-group-label">Received</span>₹{r.receivedTotal.toLocaleString('en-IN')}</p>
                    <p className="prt-outstanding" style={{ color: '#c0392b', fontWeight: 600 }}><span className="pq-group-label">Outstanding</span>₹{r.balance.toLocaleString('en-IN')}</p>
                </div>
            ))}
        </div>
    );
};

const ReceivablesPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);
    const [selectedProjectId, setSelectedProjectId] = useState('');

    return (
        <FinanceTabShell
            label="Receivables"
            subtitle="Running bills, their approval status, and what's still outstanding: with_material / without_material projects only. Advance-contract projects track payment via their own advance fields instead."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab !== 'receipts' && (
                <>
                    <ProjectPicker url={url} selectedProjectId={selectedProjectId} onChange={setSelectedProjectId} />
                    {!selectedProjectId ? (
                        <div className="admin-empty-state"><p>Select a project to view its {activeTab === 'review' ? 'work review' : 'bills'}.</p></div>
                    ) : activeTab === 'review' ? (
                        <WorkReviewPanel url={url} projectId={selectedProjectId} />
                    ) : (
                        <RunningBillsManager url={url} projectId={selectedProjectId} statusFilter={STATUS_FILTER[activeTab]} />
                    )}
                </>
            )}
            {activeTab === 'receipts' && <PendingReceiptsTab url={url} />}
        </FinanceTabShell>
    );
};

export default ReceivablesPage;
