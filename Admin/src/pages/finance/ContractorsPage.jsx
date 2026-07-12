import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import ContractorWorksView from '../../components/finance/ContractorWorksView';
import ContractorMeasurementsView from '../../components/finance/ContractorMeasurementsView';
import ContractorLedgerView from '../../components/finance/ContractorLedgerView';
import '../../styles/list.css';

const TABS = [
    { key: 'overview',     label: 'Overview' },
    { key: 'projects',     label: 'Projects' },
    { key: 'works',        label: 'Works' },
    { key: 'measurements', label: 'Measurements' },
    { key: 'ledger',       label: 'Ledger' },
    { key: 'settlements',  label: 'Settlements' },
    { key: 'bills',        label: 'Bills' },
    { key: 'documents',    label: 'Documents' },
];

const IS_CONTRACTOR = (v) => v.vendorType === 'labour_contractor';
const CONTRACT_TYPE_LABEL = { with_material: 'With Material', without_material: 'Without Material', advance: 'Advance' };
const VENDOR_SCOPED_TABS = ['works', 'measurements', 'ledger', 'settlements'];

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

/* Shared by Works / Measurements / Ledger / Settlements — all four need one
   contractor picked before they mean anything, same picker pattern used by
   Site Inventory / Receipts / unscoped Measurements elsewhere. */
const ContractorPicker = ({ url, selectedVendorId, onChange }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [vendors, setVendors] = useState([]);

    useEffect(() => {
        axios.get(`${url}/api/finance/vendors/list`, authHeader)
            .then(res => { if (res.data.success) setVendors(res.data.data.filter(IS_CONTRACTOR)); })
            .catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
            <p>Contractor</p>
            <select value={selectedVendorId} onChange={e => onChange(e.target.value)}>
                <option value="">Select contractor…</option>
                {vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
            </select>
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
            subtitle="Labour contractors — vendors with type Labour Contractor."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'overview' && <MasterCrudTable url={url} resourceKey="vendors" filter={IS_CONTRACTOR} />}
            {activeTab === 'projects' && <ContractorProjectsTab url={url} />}

            {VENDOR_SCOPED_TABS.includes(activeTab) && (
                <ContractorPicker url={url} selectedVendorId={selectedVendorId} onChange={setSelectedVendorId} />
            )}
            {activeTab === 'works' && (
                selectedVendorId ? <ContractorWorksView url={url} vendorId={selectedVendorId} /> : <div className="admin-empty-state"><p>Select a contractor to view their works.</p></div>
            )}
            {activeTab === 'measurements' && (
                selectedVendorId ? <ContractorMeasurementsView url={url} vendorId={selectedVendorId} /> : <div className="admin-empty-state"><p>Select a contractor to view their measurements.</p></div>
            )}
            {(activeTab === 'ledger' || activeTab === 'settlements') && (
                selectedVendorId ? <ContractorLedgerView url={url} vendorId={selectedVendorId} /> : <div className="admin-empty-state"><p>Select a contractor to view their ledger.</p></div>
            )}

            {activeTab === 'bills' && <PlaceholderTab text="Bills raised by/for this contractor." />}
            {activeTab === 'documents' && <PlaceholderTab text="Documents on file for this contractor." />}
        </FinanceTabShell>
    );
};

export default ContractorsPage;
