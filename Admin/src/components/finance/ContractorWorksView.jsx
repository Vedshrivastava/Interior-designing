import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { materialCostPerSqftDisplay } from './DashboardWidgets';
import { measurementUnitLabel } from '../../config/financeMasters';
import '../../styles/list.css';
import '../../styles/dashboard.css';

const STATUS_LABEL = { active: 'Active', completed: 'Completed' };

/* Read-only — this contractor's financeWork rows across every project,
   resolved via their work-contractor assignments. Editing a work happens
   on that project's own Works tab; this is just the contractor-eye view. */
const ContractorWorksView = ({ url, vendorId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [works, setWorks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!vendorId) return;
        setLoading(true);
        axios.get(`${url}/api/finance/contractors/${vendorId}/ledger`, authHeader)
            .then(res => { if (res.data.success) setWorks(res.data.data.works); else toast.error(res.data.message); })
            .catch(() => toast.error('Error fetching works'))
            .finally(() => setLoading(false));
    }, [url, vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (works.length === 0) return <div className="admin-empty-state"><p>No works for this contractor yet.</p></div>;

    return (
        <div className="dash-chart-card con-work-card">
            <div className="con-work-row con-work-header">
                <b className="con-work-project">Project</b>
                <b className="con-work-type">Work Type</b>
                <b className="con-work-area">Area Covered</b>
                <b className="con-work-cost">Material Cost/Unit</b>
                <b className="con-work-status">Status</b>
            </div>
            {works.map(w => (
                <div key={w._id} className="con-work-row">
                    <p className="con-work-project">{w.projectName}</p>
                    <p className="con-work-type"><span className="pq-group-label">Work Type</span>{w.workType}</p>
                    {/* This contractor's own logged area on this Work — not
                        compared against estimatedAreaSqft, which is the
                        whole Work's target, not this contractor's share of
                        it (a Work can have more than one contributor). */}
                    <p className="con-work-area"><span className="pq-group-label">Area Covered</span>{w.completedAreaSqft} {measurementUnitLabel(w.unit)}</p>
                    <p className="con-work-cost"><span className="pq-group-label">Material Cost/Unit</span>{materialCostPerSqftDisplay(w.materialCostPerSqftApproved, w.materialCostPerSqftUnapproved)}</p>
                    <p className="con-work-status"><span className="item-category">{STATUS_LABEL[w.status]}</span></p>
                </div>
            ))}
        </div>
    );
};

export default ContractorWorksView;
