import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { measurementUnitLabel } from '../../config/financeMasters';
import '../../styles/list.css';
import '../../styles/dashboard.css';

/* Read-only — every measurement logged against this contractor's works,
   across every project. Entry happens on Site Operations or a project's
   own Measurements tab; this is just the contractor-eye view. */
const ContractorMeasurementsView = ({ url, vendorId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [measurements, setMeasurements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!vendorId) return;
        setLoading(true);
        axios.get(`${url}/api/finance/contractors/${vendorId}/ledger`, authHeader)
            .then(res => { if (res.data.success) setMeasurements(res.data.data.measurements); else toast.error(res.data.message); })
            .catch(() => toast.error('Error fetching measurements'))
            .finally(() => setLoading(false));
    }, [url, vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (measurements.length === 0) return <div className="admin-empty-state"><p>No measurements logged against this contractor's works yet.</p></div>;

    return (
        <div className="dash-chart-card con-meas-card">
            {/* No "Approved" column — that's decided per work type at bill
                generation now (RunningBillsManager.jsx), not per daily
                entry. This stays a pure log of what was done. */}
            <div className="con-meas-row con-meas-header">
                <b className="con-meas-date">Date</b>
                <b className="con-meas-work">Work</b>
                <b className="con-meas-area">Area Covered</b>
            </div>
            {measurements.map(m => (
                <div key={m._id} className="con-meas-row">
                    <p className="con-meas-date"><span className="pq-group-label">Date</span>{new Date(m.date).toLocaleDateString()}</p>
                    <p className="con-meas-work">{m.workId?.workType || '-'}</p>
                    <p className="con-meas-area"><span className="pq-group-label">Area Covered</span>{m.areaCoveredSqft} {measurementUnitLabel(m.workId?.unit)}</p>
                </div>
            ))}
        </div>
    );
};

export default ContractorMeasurementsView;
