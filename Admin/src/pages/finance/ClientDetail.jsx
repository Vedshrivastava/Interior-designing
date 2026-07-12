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
// restructure.
const useClientProjectCount = (url, clientId) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [count, setCount] = useState(null);

    useEffect(() => {
        let cancelled = false;
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => {
                if (res.data.success && !cancelled) {
                    setCount(res.data.data.filter(p => (p.clientId?._id || p.clientId) === clientId).length);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [url, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    return count;
};

// Work types per project come from the same /api/finance/work-type-rates/list
// endpoint ProjectDetail's Works tab already uses — one call per matched
// project. Only fetched when this tab is actually opened, not on every visit
// to the client, since it's an N+1 fan-out.
const ClientProjectsTab = ({ url, clientId }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(async (res) => {
                if (!res.data.success) return;
                const clientProjects = res.data.data.filter(p => (p.clientId?._id || p.clientId) === clientId);
                const withWorkTypes = await Promise.all(clientProjects.map(async (p) => {
                    try {
                        const rateRes = await axios.get(`${url}/api/finance/work-type-rates/list`, { ...authHeader, params: { projectId: p._id } });
                        return { ...p, workTypes: rateRes.data.success ? rateRes.data.data.map(r => r.workType) : [] };
                    } catch {
                        return { ...p, workTypes: [] };
                    }
                }));
                if (!cancelled) setProjects(withWorkTypes);
            })
            .catch(() => toast.error('Error fetching projects'))
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [url, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (projects.length === 0) return <div className="admin-empty-state"><p>No projects for this client yet.</p></div>;

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>{projects.length} project{projects.length === 1 ? '' : 's'} given to us.</p>
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 2fr' }}>
                    <b>Name</b><b>Contract Type</b><b>Status</b><b>Work Types</b>
                </div>
                {projects.map(p => (
                    <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 2fr' }}>
                        <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/projects/${p._id}`)}>{p.name}</p>
                        <p><span className="item-category">{CONTRACT_TYPE_LABEL[p.contractType]}</span></p>
                        <p><span className="item-category">{STATUS_LABEL[p.status]}</span></p>
                        <p>{p.workTypes.length > 0 ? p.workTypes.join(', ') : '—'}</p>
                    </div>
                ))}
            </div>
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
    const projectCount = useClientProjectCount(url, id);

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
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Total Projects</b></p><p style={{ cursor: 'pointer' }} onClick={() => setActiveTab('projects')}>{projectCount ?? '—'}</p></div>
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
