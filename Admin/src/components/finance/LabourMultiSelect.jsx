import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AddLabourModal from './AddLabourModal';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';

/*
 * Multi-select chip picker of company-wide labourers — the building
 * block for "form a team" (WorksManager) and "set a rate for several
 * labourers at once" (WorkersManager). A labourer isn't owned by any
 * supervisor, so this always lists everyone; `excludeIds` hides ones
 * already handled by the caller (e.g. already assigned to this Work).
 * Chips instead of native checkboxes — see list.css's 4c block for why.
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
    useFinanceWsRefresh(['financeLabourersChanged'], fetchLabourers);

    const excludeSet = new Set(excludeIds);
    const visible = labourers.filter(l => !excludeSet.has(l._id));

    const toggle = (id) => {
        onChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
    };

    return (
        <div>
            <div className="labour-select-box">
                <div className="labour-select-list">
                    {visible.length === 0 ? (
                        <p className="labour-select-empty">No labourers available; add one below.</p>
                    ) : visible.map(l => {
                        const active = selectedIds.includes(l._id);
                        return (
                            <button
                                type="button" key={l._id}
                                className={`labour-chip${active ? ' active' : ''}`}
                                onClick={() => toggle(l._id)}
                                aria-pressed={active}
                            >
                                <span className="labour-chip-mark">
                                    <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1 5L4.5 8.5L11 1.5" stroke="var(--gold-lt)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                                {l.name}
                            </button>
                        );
                    })}
                </div>
                <div className="labour-select-footer">
                    <span className="labour-select-count">{selectedIds.length} selected</span>
                    <button type="button" className="add-point-btn" onClick={() => setModalOpen(true)}>+ Add New Labourer</button>
                </div>
            </div>

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
