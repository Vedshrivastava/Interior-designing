import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

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
        <div className="list-table finance-table">
            {/* No "Approved" column — that's decided per work type at bill
                generation now (RunningBillsManager.jsx), not per daily
                entry. This stays a pure log of what was done. */}
            <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1fr' }}>
                <b>Date</b><b>Work</b><b>Area Covered</b>
            </div>
            {measurements.map(m => (
                <div key={m._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1fr' }}>
                    <p>{new Date(m.date).toLocaleDateString()}</p>
                    <p>{m.workId?.workType || '-'}</p>
                    <p>{m.areaCoveredSqft} sqft</p>
                </div>
            ))}
        </div>
    );
};

export default ContractorMeasurementsView;
