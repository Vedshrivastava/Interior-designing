import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AddContractorModal from './AddContractorModal';

/*
 * Drop-in picker wherever a Work's contractor assignment or a Contractor
 * Rate row picks a contractor — scoped to labour_contractor vendors only.
 * Despite the name (kept for now to avoid touching every import site),
 * this is contractor-only; labour has its own separate LabourPicker.
 */
const ContractorOrLabourPicker = ({ url, value, onChange, placeholder }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [contractors, setContractors] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchContractors = () => {
        axios.get(`${url}/api/finance/vendors/list`, authHeader)
            .then(res => { if (res.data.success) setContractors(res.data.data.filter(v => v.vendorType === 'labour_contractor')); })
            .catch(() => {});
    };

    useEffect(() => { fetchContractors(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1 }}>
                    <option value="">{placeholder || 'Select contractor…'}</option>
                    {contractors.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
                <button type="button" className="add-point-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setModalOpen(true)}>+ Add New</button>
            </div>

            {modalOpen && (
                <AddContractorModal
                    url={url}
                    onClose={() => setModalOpen(false)}
                    onContractorCreated={(id) => { fetchContractors(); onChange(id); setModalOpen(false); }}
                />
            )}
        </>
    );
};

export default ContractorOrLabourPicker;
