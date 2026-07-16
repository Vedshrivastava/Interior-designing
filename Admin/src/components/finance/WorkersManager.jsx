import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import LabourMultiSelect from './LabourMultiSelect';
import StyledSelect from './StyledSelect';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

/* Manages financeLabourRate rows for one project — one row per (labourer,
   work type), always per-sqft (labour has no per-day payment basis).
   Renamed from "Labour Rates" to "Workers" — entry is batched: pick a
   work type, type the rate once, multi-select every labourer who earns
   that same rate for it on this project, submit once. Each selected
   labourer still gets their own financeLabourRate row underneath (so
   editing later, or a different rate on a different project, works per
   person) — the batch is purely a data-entry convenience. */
const WorkersManager = ({ url, projectId, worksVersion }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [items, setItems] = useState([]);
    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    const [realWorkTypes, setRealWorkTypes] = useState(null);
    const [workType, setWorkType] = useState('');
    const [ratePerSqft, setRatePerSqft] = useState('');
    const [selectedLabourerIds, setSelectedLabourerIds] = useState([]);
    const [saving, setSaving] = useState(false);

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/labour-rates/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error('Error fetching worker rates'); }
    };

    const fetchWorkTypeOptions = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId } });
            const fromWorks = res.data.success ? [...new Set(res.data.data.map(w => w.workType))] : [];
            if (fromWorks.length) { setWorkTypeOptions(fromWorks); setRealWorkTypes(new Set(fromWorks)); return; }
            setRealWorkTypes(null);
            const settingsRes = await axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'work_type' } });
            if (settingsRes.data.success) setWorkTypeOptions(settingsRes.data.data.map(s => s.name));
        } catch { /* leave empty — the picker's placeholder explains why */ }
    };

    useEffect(() => { if (projectId) { fetchList(); fetchWorkTypeOptions(); } }, [projectId, worksVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    // Labourers who already have a rate for the currently-picked work type
    // on this project — hidden from the multi-select so re-submitting
    // doesn't collide with an existing row (remove and re-add instead).
    const alreadyRatedIds = items.filter(i => i.workType === workType).map(i => i.labourerId?._id || i.labourerId);

    const submit = async (e) => {
        e.preventDefault();
        if (!workType.trim()) { toast.error('Work type is required'); return; }
        if (ratePerSqft === '') { toast.error('Rate is required'); return; }
        if (!selectedLabourerIds.length) { toast.error('Select at least one labourer'); return; }
        setSaving(true);
        try {
            const results = await Promise.allSettled(selectedLabourerIds.map(labourerId =>
                axios.post(`${url}/api/finance/labour-rates/add`, { projectId, labourerId, workType: workType.trim(), ratePerSqft }, authHeader)
            ));
            const failed = results.filter(r => r.status === 'rejected' || !r.value?.data?.success);
            if (failed.length) toast.error(`${failed.length} of ${results.length} failed — they may already have a rate for this work type`);
            if (failed.length < results.length) toast.success(`Rate set for ${results.length - failed.length} labourer(s)`);
            setRatePerSqft(''); setSelectedLabourerIds([]);
            await fetchList();
        } finally { setSaving(false); }
    };

    const removeRate = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/labour-rates/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing worker rate'); }
    };

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                Pick a work type, set the rate once, and select every labourer who earns that same rate for it on this project.
            </p>

            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Work Type *</p>
                        <StyledSelect
                            value={workType} onChange={setWorkType}
                            placeholder={workTypeOptions.length ? 'Select work type…' : 'Add a Work first'}
                            options={workTypeOptions.map(w => ({ value: w, label: w }))}
                        />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Rate (₹/sqft) *</p>
                        <input type="number" value={ratePerSqft} onChange={e => setRatePerSqft(e.target.value)} />
                    </div>
                </div>
                <div className="add-product-name flex-col" style={{ marginTop: '12px' }}>
                    <p>Labourers *</p>
                    <LabourMultiSelect url={url} selectedIds={selectedLabourerIds} onChange={setSelectedLabourerIds} excludeIds={alreadyRatedIds} />
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>
                        {saving ? 'Saving…' : selectedLabourerIds.length > 1 ? `+ Set Rate for ${selectedLabourerIds.length} Labourers` : '+ Add Rate'}
                    </button>
                </div>
            </form>

            <div className="list-table" style={{ marginTop: '20px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 100px' }}>
                    <b>Labourer</b><b>Work Type</b><b>Rate</b><b>Action</b>
                </div>
                {items.length === 0 ? (
                    <div className="admin-empty-state"><p>No worker rates yet.</p></div>
                ) : (
                    items.map(item => {
                        const isOrphaned = realWorkTypes && !realWorkTypes.has(item.workType);
                        return (
                            <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 100px' }}>
                                <p>{item.labourerId?.name || '—'}</p>
                                <p>
                                    {item.workType}
                                    {isOrphaned && (
                                        <span
                                            className="item-category"
                                            style={{ marginLeft: '8px', background: 'rgba(192,57,43,0.12)', color: '#c0392b', borderColor: 'rgba(192,57,43,0.3)' }}
                                            title="No Work with this type exists in this project yet — this rate isn't matched to anything and won't be used until one is added, or should be removed."
                                        >
                                            ⚠ No matching Work
                                        </span>
                                    )}
                                </p>
                                <p>₹{item.ratePerSqft}</p>
                                <div className="action-buttons">
                                    <p onClick={() => removeRate(item._id)} className="cursor delete-action">X</p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default WorkersManager;
