import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

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
        <div className="list-table finance-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1.3fr 1fr' }}>
                <b>Project</b><b>Work Type</b><b>Area Covered</b><b>Status</b>
            </div>
            {works.map(w => (
                <div key={w._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1.3fr 1fr' }}>
                    <p>{w.projectName}</p>
                    <p>{w.workType}</p>
                    {/* This labourer's own logged area on this Work — not
                        compared against estimatedAreaSqft, which is the
                        whole Work's target, not this labourer's share of
                        it (a Work can have more than one contributor). */}
                    <p>{w.completedAreaSqft} sqft</p>
                    <p><span className="item-category">{STATUS_LABEL[w.status]}</span></p>
                </div>
            ))}
        </div>
    );
};

export default LabourWorksView;
