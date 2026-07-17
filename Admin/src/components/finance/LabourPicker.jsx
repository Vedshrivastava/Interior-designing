import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AddLabourModal from './AddLabourModal';

/*
 * Single-select labourer picker — mirrors ContractorOrLabourPicker. Lists
 * every labourer company-wide (a labourer isn't owned by any supervisor).
 */
const LabourPicker = ({ url, value, onChange, placeholder }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [labourers, setLabourers] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchLabourers = () => {
        axios.get(`${url}/api/finance/labourers/list`, authHeader)
            .then(res => { if (res.data.success) setLabourers(res.data.data); })
            .catch(() => {});
    };

    useEffect(() => { fetchLabourers(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1 }}>
                    <option value="">{placeholder || 'Select labourer…'}</option>
                    {labourers.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
                <button type="button" className="add-point-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setModalOpen(true)}>+ Add New</button>
            </div>

            {modalOpen && (
                <AddLabourModal
                    url={url}
                    onClose={() => setModalOpen(false)}
                    onLabourerCreated={(id) => { fetchLabourers(); onChange(id); setModalOpen(false); }}
                />
            )}
        </>
    );
};

export default LabourPicker;
