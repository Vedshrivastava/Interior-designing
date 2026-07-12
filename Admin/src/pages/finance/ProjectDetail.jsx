import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import WorkTypeRatesManager from '../../components/finance/WorkTypeRatesManager';
import TeamRatesManager from '../../components/finance/TeamRatesManager';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import '../../styles/list.css';

/*
 * Reordered/expanded from the original 6 tabs (Basic Info, Work Type Rates,
 * Team Rates, BOQ Estimate, Material Stock, Lifetime Summary) to the target
 * 13-tab structure. Nothing real was dropped: Work Type Rates + Team Rates
 * (both fully working, Phase 0.5) now live together under "Works"; the
 * Labour Contractor / Referral Vendor fields moved out of Overview into
 * their own "Contractors" tab, and Assigned Supervisor into "Supervisors" —
 * both still the same project fields, just surfaced in their new home.
 */
const TABS = [
    { key: 'overview',     label: 'Overview' },
    { key: 'works',        label: 'Works' },
    { key: 'measurements', label: 'Measurements' },
    { key: 'materials',    label: 'Materials' },
    { key: 'contractors',  label: 'Contractors' },
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
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(false);

    const fetchProject = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/projects/${id}`, authHeader);
            if (res.data.success) setProject(res.data.data.project);
            else toast.error(res.data.message);
        } catch { toast.error('Error fetching project'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchProject(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    const activate = async () => {
        setActivating(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/activate`, { _id: id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchProject(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error activating project'); }
        finally { setActivating(false); }
    };

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
                        </p>
                    </div>
                    {project.status === 'draft' && (
                        <button type="button" className="add-point-btn" disabled={activating} onClick={activate}>
                            {activating ? 'Activating…' : 'Activate Project'}
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
                    <div className="list-table">
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Site Location</b></p><p>{project.siteLocation || '—'}</p></div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Start Date</b></p><p>{project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}</p></div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Estimated Area</b></p><p>{project.estimatedAreaSqft || 0} sqft</p></div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Material Tracking</b></p><p>{project.materialTrackingEnabled ? 'Enabled' : 'Disabled'}</p></div>
                        {project.contractType === 'advance' && (
                            <>
                                <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Total Estimated Cost</b></p><p>₹{project.totalEstimatedCost?.toLocaleString('en-IN')}</p></div>
                                <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Contract Percentage</b></p><p>{project.contractPercentage}%</p></div>
                                <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Advance Amount</b></p><p>₹{project.advanceAmount?.toLocaleString('en-IN')}</p></div>
                                <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Advance Received</b></p><p>{project.advanceReceived ? `Yes — ${new Date(project.advanceReceivedAt).toLocaleDateString()}` : 'Not yet'}</p></div>
                            </>
                        )}
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Notes</b></p><p>{project.notes || '—'}</p></div>
                    </div>
                )}

                {activeTab === 'works' && (
                    <div>
                        <h3 style={{ marginBottom: '8px' }}>Work Type Rates</h3>
                        <WorkTypeRatesManager url={url} projectId={id} />
                        <h3 style={{ margin: '28px 0 8px' }}>Team Rates</h3>
                        <TeamRatesManager url={url} projectId={id} />
                        <p className="admin-subtitle" style={{ marginTop: '16px' }}>
                            Individual per-work tracking (measurements, completion status) — the full "Works" entity — is future work; rates are set here today.
                        </p>
                    </div>
                )}

                {activeTab === 'measurements' && <PlaceholderTab text="Site measurements recorded against this project's works." />}

                {activeTab === 'materials' && <PlaceholderTab text="Material stock and consumption for this project." phase="Phase 2" />}

                {activeTab === 'contractors' && (
                    <div className="list-table">
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Labour Contractor</b></p><p>{project.labourContractorVendorId?.name || '—'}</p></div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Referral Vendor</b></p><p>{project.referralVendorId?.name || '—'}</p></div>
                    </div>
                )}

                {activeTab === 'supervisors' && (
                    <div className="list-table">
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Assigned Supervisor</b></p><p>{project.assignedSupervisor || '—'}</p></div>
                    </div>
                )}

                {activeTab === 'runningBills' && <PlaceholderTab text="Bills currently being prepared for this project." phase="Phase 3" />}
                {activeTab === 'receipts' && <PlaceholderTab text="Payments received for this project." phase="Phase 3" />}
                {activeTab === 'expenses' && <PlaceholderTab text="Site expenses logged against this project." />}
                {activeTab === 'documents' && <PlaceholderTab text="Documents on file for this project." />}
                {activeTab === 'photos' && <PlaceholderTab text="Site photos for this project." />}
                {activeTab === 'timeline' && <PlaceholderTab text="Chronological activity log for this project." />}
                {activeTab === 'profitability' && <PlaceholderTab text="Lifetime billing, cost, and profit summary for this project." phase="Phase 2" />}
            </div>
        </div>
    );
};

export default ProjectDetail;
