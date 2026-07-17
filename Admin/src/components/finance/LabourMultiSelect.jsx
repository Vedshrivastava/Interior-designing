import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AddLabourModal from './AddLabourModal';

/*
 * Multi-select checkbox list of company-wide labourers — the building
 * block for "form a team" (WorksManager) and "set a rate for several
 * labourers at once" (LabourWorkersManager). A labourer isn't owned by
 * any supervisor, so this always lists everyone; `excludeIds` hides ones
 * already handled by the caller (e.g. already assigned to this Work).
 */
const LabourMultiSelect = ({ url, selectedIds, onChange, excludeIds = [] }) => {
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

    const excludeSet = new Set(excludeIds);
    const visible = labourers.filter(l => !excludeSet.has(l._id));

    const toggle = (id) => {
        onChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
    };

    return (
        <div>
            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid rgba(201,168,124,0.28)', borderRadius: '8px', padding: '10px' }}>
                {visible.length === 0 ? (
                    <p className="admin-subtitle" style={{ margin: 0 }}>No labourers available — add one below.</p>
                ) : visible.map(l => (
                    <label key={l._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}>
                        <input type="checkbox" checked={selectedIds.includes(l._id)} onChange={() => toggle(l._id)}
                            style={{
                                width: '16px', height: '16px', flex: '0 0 16px', padding: 0, margin: 0,
                                border: 'none', background: 'none', borderRadius: 0,
                                accentColor: 'var(--gold, #c9a87c)', appearance: 'auto', WebkitAppearance: 'checkbox',
                            }} />
                        <span>{l.name}</span>
                    </label>
                ))}
            </div>
            <button type="button" className="add-point-btn" style={{ marginTop: '8px' }} onClick={() => setModalOpen(true)}>+ Add New Labourer</button>

            {modalOpen && (
                <AddLabourModal
                    url={url}
                    onClose={() => setModalOpen(false)}
                    onLabourerCreated={(id) => { fetchLabourers(); onChange([...selectedIds, id]); setModalOpen(false); }}
                />
            )}
        </div>
    );
};

export default LabourMultiSelect;
