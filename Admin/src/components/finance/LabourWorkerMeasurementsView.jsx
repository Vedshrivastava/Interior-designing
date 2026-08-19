import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { measurementUnitLabel } from '../../config/financeMasters';
import '../../styles/list.css';
import '../../styles/dashboard.css';

/* Read-only — every measurement logged against this labourer's works,
   across every project. Entry happens on Site Operations or a project's
   own Measurements tab; this is just the labourer-eye view. Mirrors
   ContractorMeasurementsView, minus the Approved column — labour
   measurements have no per-entry approval gate. */
const LabourWorkerMeasurementsView = ({ url, labourerId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [measurements, setMeasurements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!labourerId) return;
        setLoading(true);
        axios.get(`${url}/api/finance/labourer-ledger/${labourerId}/ledger`, authHeader)
            .then(res => { if (res.data.success) setMeasurements(res.data.data.measurements); else toast.error(res.data.message); })
            .catch(() => toast.error('Error fetching measurements'))
            .finally(() => setLoading(false));
    }, [url, labourerId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (measurements.length === 0) return <div className="admin-empty-state"><p>No measurements logged against this labourer's works yet.</p></div>;

    return (
        <div className="dash-chart-card lam-card">
            <div className="lam-row lam-header">
                <b className="lam-date">Date</b>
                <b className="lam-work">Work</b>
                <b className="lam-area">Area Covered</b>
            </div>
            {measurements.map(m => (
                <div key={m._id} className="lam-row">
                    <p className="lam-date"><span className="pq-group-label">Date</span>{new Date(m.date).toLocaleDateString()}</p>
                    <p className="lam-work">{m.workId?.workType || '-'}</p>
                    <p className="lam-area"><span className="pq-group-label">Area Covered</span>{m.areaCoveredSqft} {measurementUnitLabel(m.workId?.unit)}</p>
                </div>
            ))}
        </div>
    );
};

export default LabourWorkerMeasurementsView;
