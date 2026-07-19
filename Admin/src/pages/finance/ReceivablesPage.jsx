import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import RunningBillsManager from '../../components/finance/RunningBillsManager';
import WorkReviewPanel from '../../components/finance/WorkReviewPanel';

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
            <select value={selectedProjectId} onChange={e => onChange(e.target.value)}>
                <option value="">Select project…</option>
                {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
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
        <div className="list-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 1fr 1fr' }}>
                <b>Project</b><b>Client</b><b>Issued</b><b>Received</b><b>Outstanding</b>
            </div>
            {rows.map(r => (
                <div key={r.projectId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 1fr 1fr' }}>
                    <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/projects/${r.projectId}`)}>{r.projectName}</p>
                    <p>{r.clientName || '-'}</p>
                    <p>₹{r.issuedTotal.toLocaleString('en-IN')}</p>
                    <p>₹{r.receivedTotal.toLocaleString('en-IN')}</p>
                    <p style={{ color: '#c0392b', fontWeight: 600 }}>₹{r.balance.toLocaleString('en-IN')}</p>
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
