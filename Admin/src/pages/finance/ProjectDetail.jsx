import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import WorkTypeRatesManager from '../../components/finance/WorkTypeRatesManager';
import TeamRatesManager from '../../components/finance/TeamRatesManager';
import '../../styles/list.css';

const TABS = [
    { key: 'basic', label: 'Basic Info' },
    { key: 'rates', label: 'Work Type Rates' },
    { key: 'teams', label: 'Team Rates' },
    { key: 'boq', label: 'BOQ Estimate' },
    { key: 'stock', label: 'Material Stock' },
    { key: 'lifetime', label: 'Lifetime Summary' },
];

const CONTRACT_TYPE_LABEL = { with_material: 'With Material', without_material: 'Without Material', advance: 'Advance' };
const STATUS_LABEL = { draft: 'Draft', active: 'Active', completed: 'Completed' };

const ComingSoonTab = ({ text }) => (
    <div className="admin-empty-state"><p>{text}</p></div>
);

const ProjectDetail = ({ url }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [activeTab, setActiveTab] = useState('basic');
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

                {activeTab === 'basic' && (
                    <div className="list-table">
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Site Location</b></p><p>{project.siteLocation || '—'}</p></div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Assigned Supervisor</b></p><p>{project.assignedSupervisor || '—'}</p></div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Labour Contractor</b></p><p>{project.labourContractorVendorId?.name || '—'}</p></div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Referral Vendor</b></p><p>{project.referralVendorId?.name || '—'}</p></div>
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

                {activeTab === 'rates' && <WorkTypeRatesManager url={url} projectId={id} />}
                {activeTab === 'teams' && <TeamRatesManager url={url} projectId={id} />}
                {activeTab === 'boq' && <ComingSoonTab text="BOQ Estimate — part of Phase 3 (Financial Registers)." />}
                {activeTab === 'stock' && <ComingSoonTab text="Material Stock — part of Phase 2 (Calculation Engine)." />}
                {activeTab === 'lifetime' && <ComingSoonTab text="Lifetime Summary — part of Phase 2 (Calculation Engine)." />}
            </div>
        </div>
    );
};

export default ProjectDetail;
