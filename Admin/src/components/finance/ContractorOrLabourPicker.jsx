import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AddContractorModal from './AddContractorModal';
import StyledSelect from './StyledSelect';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

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
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchContractors = () => {
        axios.get(`${url}/api/finance/vendors/list`, authHeader)
            .then(res => { if (res.data.success) setContractors(res.data.data.filter(v => v.vendorType === 'labour_contractor')); })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchContractors(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeVendorsChanged'], fetchContractors);

    return (
        <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    <StyledSelect
                        value={value} onChange={onChange} placeholder={placeholder || 'Select contractor…'} loading={loading}
                        options={contractors.map(c => ({ value: c._id, label: c.name }))}
                    />
                </div>
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
