import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import QuickAddWorkModal from './QuickAddWorkModal';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { workType: '', clientRate: '', referralRate: '' };

/* Manages financeWorkTypeRate rows for one project — used in both the New
   Project wizard (Step 3) and the Project Detail page's Work Type Rates tab.
   `worksVersion` is only ever passed from the Project Detail page (see
   ProjectDetail.jsx) — used here to gate the "+ Add Work" quick-add dialog,
   since offering it during the wizard's Step 3 would force creating a Work
   before the wizard's own flow is ready for that (Works only get added
   later, from Project Detail, once the project is live). */
const WorkTypeRatesManager = ({ url, projectId, worksVersion }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const allowQuickAddWork = worksVersion !== undefined;

    const [items, setItems] = useState([]);
    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    // null until this project has at least one real Work — orphan-flagging
    // only makes sense once there's something real to check against;
    // during setup (no Works yet) every rate is expected to look "unmatched".
    const [realWorkTypes, setRealWorkTypes] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [quickAddOpen, setQuickAddOpen] = useState(false);

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/work-type-rates/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error('Error fetching work type rates'); }
    };

    useEffect(() => { if (projectId) fetchList(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A rate should only ever be settable for a work type this project
    // actually has a Work for — not free text. But the New Project wizard
    // sets these rates in Step 3, before any Work exists (Works only get
    // added later, from Project Detail) — so fall back to the Settings
    // master list until this project has at least one real Work.
    const refreshWorkTypeOptions = async () => {
        if (!projectId) return;
        try {
            const res = await axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId } });
            const fromWorks = res.data.success ? [...new Set(res.data.data.map(w => w.workType))] : [];
            if (fromWorks.length) { setWorkTypeOptions(fromWorks); setRealWorkTypes(new Set(fromWorks)); return; }
            setRealWorkTypes(null);
            const settingsRes = await axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'work_type' } });
            if (settingsRes.data.success) setWorkTypeOptions(settingsRes.data.data.map(s => s.name));
        } catch { /* leave options as-is */ }
    };

    useEffect(() => { refreshWorkTypeOptions(); }, [url, projectId, worksVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleWorkCreated = async (newWork) => {
        setQuickAddOpen(false);
        await refreshWorkTypeOptions();
        setForm(prev => ({ ...prev, workType: newWork.workType }));
    };

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    // Add-only, deliberately — once a rate is confirmed it shouldn't be
    // silently changed underneath work already measured/billed against it.
    // Remove and re-add if a rate was entered wrong.
    const submit = async (e) => {
        e.preventDefault();
        if (!form.workType.trim()) { toast.error('Work type is required'); return; }
        if (form.clientRate === '') { toast.error('Client rate is required'); return; }
        setSaving(true);
        try {
            const payload = {
                projectId, workType: form.workType.trim(),
                clientRatePerSqft: form.clientRate, referralRatePerSqft: form.referralRate || 0,
            };
            const res = await axios.post(`${url}/api/finance/work-type-rates/add`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Rate added');
                setForm(emptyForm);
                await fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding rate');
        } finally { setSaving(false); }
    };

    const removeRate = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/work-type-rates/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing rate'); }
    };

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                Client rate + referral rate, per work type. Required before this project can go active.
            </p>

            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Work Type *</p>
                        {realWorkTypes === null && allowQuickAddWork ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className="admin-subtitle" style={{ flex: 1 }}>No Works added to this project yet</span>
                                <button type="button" className="add-point-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setQuickAddOpen(true)}>+ Add Work</button>
                            </div>
                        ) : (
                            <StyledSelect
                                value={form.workType} onChange={v => setField('workType', v)}
                                placeholder={workTypeOptions.length ? 'Select work type…' : 'Add a Work first'}
                                options={workTypeOptions.map(w => ({ value: w, label: w }))}
                            />
                        )}
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Client Rate (₹/sqft) *</p>
                        <input type="number" value={form.clientRate} onChange={e => setField('clientRate', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Referral Rate (₹/sqft)</p>
                        <input type="number" value={form.referralRate} onChange={e => setField('referralRate', e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Adding…' : '+ Add Rate'}</button>
                </div>
            </form>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1fr 1fr 100px' }}>
                    <b>Work Type</b><b>Client ₹/sqft</b><b>Referral ₹/sqft</b><b>Action</b>
                </div>
                {items.length === 0 ? (
                    <div className="admin-empty-state"><p>No work type rates yet.</p></div>
                ) : (
                    items.map(item => {
                        const isOrphaned = realWorkTypes && !realWorkTypes.has(item.workType);
                        return (
                            <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr 1fr 100px' }}>
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
                                <p>₹{item.clientRatePerSqft}</p>
                                <p>₹{item.referralRatePerSqft}</p>
                                <div className="action-buttons">
                                    <p onClick={() => removeRate(item._id)} className="cursor delete-action">X</p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {quickAddOpen && (
                <QuickAddWorkModal url={url} projectId={projectId} onClose={() => setQuickAddOpen(false)} onCreated={handleWorkCreated} />
            )}
        </div>
    );
};

export default WorkTypeRatesManager;
