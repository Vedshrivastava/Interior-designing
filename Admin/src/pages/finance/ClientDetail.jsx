import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import '../../styles/list.css';

const TABS = [
    { key: 'details',   label: 'Client Details' },
    { key: 'projects',  label: 'Projects' },
    { key: 'quotations', label: 'Quotations' },
    { key: 'receipts',  label: 'Receipts' },
    { key: 'bills',     label: 'Bills' },
    { key: 'documents', label: 'Documents' },
    { key: 'contacts',  label: 'Contact Persons' },
    { key: 'payments',  label: 'Payment History' },
    { key: 'ledger',    label: 'Ledger' },
];

const CONTRACT_TYPE_LABEL = { with_material: 'With Material', without_material: 'Without Material', advance: 'Advance' };
const STATUS_LABEL = { draft: 'Draft', active: 'Active', completed: 'Completed' };

// There is no GET /api/finance/clients/:id endpoint — the client and its
// projects are both found by filtering the existing /list responses
// client-side, same as the "REAL-ish" pattern used elsewhere in this
// restructure. No backend change.
const ClientProjectsTab = ({ url, clientId }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => {
                if (res.data.success) {
                    setProjects(res.data.data.filter(p => (p.clientId?._id || p.clientId) === clientId));
                }
            })
            .catch(() => toast.error('Error fetching projects'))
            .finally(() => setLoading(false));
    }, [url, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (projects.length === 0) return <div className="admin-empty-state"><p>No projects for this client yet.</p></div>;

    return (
        <div className="list-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                <b>Name</b><b>Contract Type</b><b>Status</b>
            </div>
            {projects.map(p => (
                <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                    <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/projects/${p._id}`)}>{p.name}</p>
                    <p><span className="item-category">{CONTRACT_TYPE_LABEL[p.contractType]}</span></p>
                    <p><span className="item-category">{STATUS_LABEL[p.status]}</span></p>
                </div>
            ))}
        </div>
    );
};

const ClientDetail = ({ url }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [activeTab, setActiveTab] = useState('details');
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`${url}/api/finance/clients/list`, authHeader)
            .then(res => {
                if (res.data.success) setClient(res.data.data.find(c => c._id === id) || null);
                else toast.error(res.data.message);
            })
            .catch(() => toast.error('Error fetching client'))
            .finally(() => setLoading(false));
    }, [url, id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return <div className="list add flex-col"><div className="admin-list-container"><div className="admin-empty-state"><p>Loading…</p></div></div></div>;
    }
    if (!client) {
        return <div className="list add flex-col"><div className="admin-list-container"><div className="admin-empty-state"><p>Client not found.</p></div></div></div>;
    }

    const backLink = (
        <button type="button" className="admin-search-clear" style={{ position: 'static', fontSize: '0.8rem', color: 'var(--text-lt)', marginBottom: '8px' }} onClick={() => navigate('/finance/clients')}>← All Clients</button>
    );

    return (
        <FinanceTabShell
            label={client.name}
            subtitle={client.phone || client.email || undefined}
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
            backLink={backLink}
        >
            {activeTab === 'details' && (
                <div className="list-table">
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Name</b></p><p>{client.name}</p></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Phone</b></p><p>{client.phone || '—'}</p></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Email</b></p><p>{client.email || '—'}</p></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Address</b></p><p>{client.address || '—'}</p></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>GST Number</b></p><p>{client.gstNumber || '—'}</p></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Notes</b></p><p>{client.notes || '—'}</p></div>
                </div>
            )}
            {activeTab === 'projects' && <ClientProjectsTab url={url} clientId={client._id} />}
            {activeTab === 'quotations' && <PlaceholderTab text="Client quotations issued, pre-project." phase="Phase 3" />}
            {activeTab === 'receipts' && <PlaceholderTab text="Payments received from this client." />}
            {activeTab === 'bills' && <PlaceholderTab text="Bills raised to this client." />}
            {activeTab === 'documents' && <PlaceholderTab text="Documents on file for this client." />}
            {activeTab === 'contacts' && <PlaceholderTab text="Additional contact persons for this client." />}
            {activeTab === 'payments' && <PlaceholderTab text="Full payment history for this client." />}
            {activeTab === 'ledger' && <PlaceholderTab text="Running balance ledger for this client." />}
        </FinanceTabShell>
    );
};

export default ClientDetail;
