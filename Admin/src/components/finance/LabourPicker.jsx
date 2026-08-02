import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AddLabourModal from './AddLabourModal';
import StyledSelect from './StyledSelect';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

/*
 * Single-select labourer picker — mirrors ContractorOrLabourPicker. Lists
 * every labourer company-wide (a labourer isn't owned by any supervisor).
 */
const LabourPicker = ({ url, value, onChange, placeholder }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [labourers, setLabourers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchLabourers = () => {
        axios.get(`${url}/api/finance/labourers/list`, authHeader)
            .then(res => { if (res.data.success) setLabourers(res.data.data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchLabourers(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeLabourersChanged'], fetchLabourers);

    return (
        <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    <StyledSelect
                        value={value} onChange={onChange} placeholder={placeholder || 'Select labourer…'} loading={loading}
                        options={labourers.map(l => ({ value: l._id, label: l.name }))}
                    />
                </div>
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
