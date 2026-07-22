import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import QuickAddPicker from '../../components/finance/QuickAddPicker';
import LabourMeasurementsManager from '../../components/finance/LabourMeasurementsManager';
import LabourWorksView from '../../components/finance/LabourWorksView';
import LabourWorkerMeasurementsView from '../../components/finance/LabourWorkerMeasurementsView';
import LabourLedgerView from '../../components/finance/LabourLedgerView';
import LabourProviderLedgerView from '../../components/finance/LabourProviderLedgerView';
import PersonDocumentsView from '../../components/finance/PersonDocumentsView';
import '../../styles/list.css';

const TABS = [
    { key: 'entries',      label: 'All Entries' },
    { key: 'overview',     label: 'Overview' },
    { key: 'projects',     label: 'Projects' },
    { key: 'works',        label: 'Works' },
    { key: 'measurements', label: 'Measurements' },
    { key: 'ledger',       label: 'Ledger' },
    { key: 'labourProviders', label: 'Labour Providers' },
    { key: 'providerLedger', label: 'Labour Provider Ledger' },
    { key: 'documents',    label: 'Documents' },
];

const LABOURER_SCOPED_TABS = ['projects', 'works', 'measurements', 'ledger', 'documents'];

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
        <div className="list-table finance-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 2fr' }}>
                <b>Project</b><b>Work Types</b>
            </div>
            {projects.map(p => (
                <div key={p.projectId} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 2fr' }}>
                    <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/projects/${p.projectId}`)}>{p.projectName}</p>
                    <p>{p.workTypes.join(', ')}</p>
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
            {activeTab === 'overview' && <MasterCrudTable url={url} resourceKey="labourers" />}

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
            {activeTab === 'labourProviders' && <MasterCrudTable url={url} resourceKey="labourProviders" />}
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
