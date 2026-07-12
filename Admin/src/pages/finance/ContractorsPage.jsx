import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import '../../styles/list.css';

const TABS = [
    { key: 'overview',     label: 'Overview' },
    { key: 'projects',     label: 'Projects' },
    { key: 'settlements',  label: 'Settlements' },
    { key: 'works',        label: 'Works' },
    { key: 'measurements', label: 'Measurements' },
    { key: 'bills',        label: 'Bills' },
    { key: 'payments',     label: 'Payments' },
    { key: 'ledger',       label: 'Ledger' },
    { key: 'documents',    label: 'Documents' },
];

const IS_CONTRACTOR = (v) => v.vendorType === 'labour_contractor';
const CONTRACT_TYPE_LABEL = { with_material: 'With Material', without_material: 'Without Material', advance: 'Advance' };

/* Projects with a labour contractor assigned — same /api/finance/projects/list
   response used everywhere else, filtered client-side on labourContractorVendorId. */
const ContractorProjectsTab = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => {
                if (res.data.success) setProjects(res.data.data.filter(p => p.labourContractorVendorId));
            })
            .catch(() => toast.error('Error fetching projects'))
            .finally(() => setLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (projects.length === 0) return <div className="admin-empty-state"><p>No projects with a labour contractor assigned yet.</p></div>;

    return (
        <div className="list-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1.3fr 1fr' }}>
                <b>Project</b><b>Contractor</b><b>Contract Type</b>
            </div>
            {projects.map(p => (
                <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1.3fr 1fr' }}>
                    <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/projects/${p._id}`)}>{p.name}</p>
                    <p>{p.labourContractorVendorId?.name || '—'}</p>
                    <p><span className="item-category">{CONTRACT_TYPE_LABEL[p.contractType]}</span></p>
                </div>
            ))}
        </div>
    );
};

/* Contractors are financeVendor rows with vendorType 'labour_contractor' —
   same data/CRUD as Procurement's Vendors tab, filtered the other way.
   Settlements absorbs the old standalone "Month-End Settlements" (Phase 2)
   nav item — that's what "Labour Settlement" was describing. */
const ContractorsPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);

    return (
        <FinanceTabShell
            label="Contractors"
            subtitle="Labour contractors — vendors with type Labour Contractor."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'overview' && <MasterCrudTable url={url} resourceKey="vendors" filter={IS_CONTRACTOR} />}
            {activeTab === 'projects' && <ContractorProjectsTab url={url} />}
            {activeTab === 'settlements' && <PlaceholderTab text="Monthly net payable per project + team, after advances and recoveries." phase="Phase 2" />}
            {activeTab === 'works' && <PlaceholderTab text="Work items performed by this contractor's teams." />}
            {activeTab === 'measurements' && <PlaceholderTab text="Measurements recorded against this contractor's work." />}
            {activeTab === 'bills' && <PlaceholderTab text="Bills raised by/for this contractor." />}
            {activeTab === 'payments' && <PlaceholderTab text="Payments made to this contractor." />}
            {activeTab === 'ledger' && <PlaceholderTab text="Running balance ledger per contractor." />}
            {activeTab === 'documents' && <PlaceholderTab text="Documents on file for this contractor." />}
        </FinanceTabShell>
    );
};

export default ContractorsPage;
