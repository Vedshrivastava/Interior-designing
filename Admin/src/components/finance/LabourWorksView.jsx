import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { materialCostPerSqftDisplay } from './DashboardWidgets';
import '../../styles/list.css';
import '../../styles/dashboard.css';

const STATUS_LABEL = { active: 'Active', completed: 'Completed' };

/* Read-only — this labourer's financeWork rows across every project,
   resolved via their work-labour assignments. Mirrors ContractorWorksView;
   the labourer ledger endpoint returns the same works[] shape as the
   contractor ledger does. */
const LabourWorksView = ({ url, labourerId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [works, setWorks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!labourerId) return;
        setLoading(true);
        axios.get(`${url}/api/finance/labourer-ledger/${labourerId}/ledger`, authHeader)
            .then(res => { if (res.data.success) setWorks(res.data.data.works); else toast.error(res.data.message); })
            .catch(() => toast.error('Error fetching works'))
            .finally(() => setLoading(false));
    }, [url, labourerId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (works.length === 0) return <div className="admin-empty-state"><p>No works for this labourer yet.</p></div>;

    return (
        <div className="dash-chart-card law-card">
            <div className="law-row law-header">
                <b className="law-project">Project</b>
                <b className="law-type">Work Type</b>
                <b className="law-area">Area Covered</b>
                <b className="law-cost">Material Cost/Sqft</b>
                <b className="law-status">Status</b>
            </div>
            {works.map(w => (
                <div key={w._id} className="law-row">
                    <p className="law-project">{w.projectName}</p>
                    <p className="law-type"><span className="pq-group-label">Work Type</span>{w.workType}</p>
                    {/* This labourer's own logged area on this Work — not
                        compared against estimatedAreaSqft, which is the
                        whole Work's target, not this labourer's share of
                        it (a Work can have more than one contributor). */}
                    <p className="law-area"><span className="pq-group-label">Area Covered</span>{w.completedAreaSqft} sqft</p>
                    <p className="law-cost"><span className="pq-group-label">Material Cost/Sqft</span>{materialCostPerSqftDisplay(w.materialCostPerSqft, w.approvedAreaSqft)}</p>
                    <p className="law-status"><span className="item-category">{STATUS_LABEL[w.status]}</span></p>
                </div>
            ))}
        </div>
    );
};

export default LabourWorksView;
