import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AddContractorOrLabourModal from './AddContractorOrLabourModal';

/*
 * Drop-in picker wherever a Work's labour assignment or a Labour Rate row
 * picks a labourer — mirrors ContractorOrLabourPicker. Lists every
 * labourer company-wide (with their supervisor's name, since two
 * supervisors' rosters can share a first name) and opens the same
 * Contractor-or-Labour modal for "+ Add New", pre-set to the Labour tab.
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
                    {labourers.map(l => <option key={l._id} value={l._id}>{l.name}{l.supervisorId?.name ? ` (${l.supervisorId.name}'s roster)` : ''}</option>)}
                </select>
                <button type="button" className="add-point-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setModalOpen(true)}>+ Add New</button>
            </div>

            {modalOpen && (
                <AddContractorOrLabourModal
                    url={url}
                    initialType="labour"
                    onClose={() => setModalOpen(false)}
                    onLabourerCreated={(id) => { fetchLabourers(); onChange(id); setModalOpen(false); }}
                />
            )}
        </>
    );
};

export default LabourPicker;
