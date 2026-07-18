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
   `worksVersion` is only ever passed from the Project Detail page — used
   here to gate the "+ Add Work" quick-add dialog, since offering it during
   the wizard's Step 3 would force creating a Work before the wizard's own
   flow is ready for that (Works only get added later, from Project Detail).

   Unlike Contractor Rates, a work type rate has no contractor dimension —
   it's just (project, workType) -> clientRate/referralRate. So once the
   project has real Works, this is one row per real work type, no grouping
   needed: a saved rate shows read-only + Remove, an unset one shows inline
   Client/Referral inputs + Save. The old select-driven form only survives
   as the fallback for a project with no real Works yet. */
const WorkTypeRatesManager = ({ url, projectId, worksVersion }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const allowQuickAddWork = worksVersion !== undefined;

    const [items, setItems] = useState([]);
    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    // null until this project has at least one real Work — gates the grid
    // vs. fallback-form choice below, same reasoning as ContractorRatesManager.
    // Deliberately distinct from loadingWorkTypes below: null means "checked,
    // there genuinely aren't any" — it must never be the value shown while
    // still waiting on the fetch, or the fallback form (built for a truly
    // work-less project) flashes on screen every refresh before the real
    // answer comes back.
    const [realWorkTypes, setRealWorkTypes] = useState(null);
    const [loadingWorkTypes, setLoadingWorkTypes] = useState(true);

    // Fallback-form state (only used when realWorkTypes === null).
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [quickAddOpen, setQuickAddOpen] = useState(false);

    // Grid state — pending client/referral rate per unset work type, keyed
    // by workType, and which one is currently being saved.
    const [pending, setPending] = useState({});
    const [savingKey, setSavingKey] = useState(null);

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/work-type-rates/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error('Error fetching work type rates'); }
    };

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
        finally { setLoadingWorkTypes(false); }
    };

    useEffect(() => { fetchList(); refreshWorkTypeOptions(); }, [projectId, worksVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleWorkCreated = async (newWork) => {
        setQuickAddOpen(false);
        await refreshWorkTypeOptions();
        setForm(prev => ({ ...prev, workType: newWork.workType }));
    };

    // --- Fallback form (no real Works yet) ---

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

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

    // --- Grid (real Works exist) ---

    const setPendingField = (workType, field, value) =>
        setPending(prev => ({ ...prev, [workType]: { ...(prev[workType] || { clientRate: '', referralRate: '' }), [field]: value } }));

    const saveGridRate = async (workType) => {
        const entry = pending[workType] || { clientRate: '', referralRate: '' };
        if (entry.clientRate === '') { toast.error('Client rate is required'); return; }
        setSavingKey(workType);
        try {
            const payload = { projectId, workType, clientRatePerSqft: entry.clientRate, referralRatePerSqft: entry.referralRate || 0 };
            const res = await axios.post(`${url}/api/finance/work-type-rates/add`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Rate saved');
                setPending(prev => { const next = { ...prev }; delete next[workType]; return next; });
                await fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving rate');
        } finally { setSavingKey(null); }
    };

    const removeRate = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/work-type-rates/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing rate'); }
    };

    const findExisting = (workType) => items.find(i => i.workType === workType);

    return (
        <div>
            {loadingWorkTypes ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : realWorkTypes === null ? (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                        Client rate + referral rate, per work type. Required before this project can go active.
                    </p>
                    <form onSubmit={submit}>
                        <div className="wizard-field-grid">
                            <div className="add-product-name flex-col">
                                <p>Work Type *</p>
                                {allowQuickAddWork ? (
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
                </>
            ) : (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                        One row per work type this project actually has; fill in a rate to confirm it.
                    </p>
                    <div className="list-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.2fr 1.2fr 1.2fr 1fr' }}>
                            <b>Work Type</b><b>Client Rate</b><b>Referral Rate</b><b>Action</b>
                        </div>
                        {[...realWorkTypes].map(workType => {
                            const existing = findExisting(workType);
                            const entry = pending[workType] || { clientRate: '', referralRate: '' };
                            return (
                                <div
                                    key={workType} className="list-table-format row-item"
                                    style={{ gridTemplateColumns: '1.2fr 1.2fr 1.2fr 1fr', alignItems: 'start' }}
                                >
                                    <p>{workType}</p>
                                    {existing ? (
                                        <>
                                            <p className="rate-entry-saved">₹{existing.clientRatePerSqft}/sqft</p>
                                            <p className="rate-entry-saved">₹{existing.referralRatePerSqft}/sqft</p>
                                            <div className="action-buttons">
                                                <p onClick={() => removeRate(existing._id)} className="cursor delete-action">Remove</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <input
                                                type="number" className="rate-entry-input" placeholder="₹/sqft" value={entry.clientRate} style={{ width: '100%' }}
                                                onChange={e => setPendingField(workType, 'clientRate', e.target.value)}
                                            />
                                            <input
                                                type="number" className="rate-entry-input" placeholder="₹/sqft" value={entry.referralRate} style={{ width: '100%' }}
                                                onChange={e => setPendingField(workType, 'referralRate', e.target.value)}
                                            />
                                            <div className="action-buttons">
                                                <button
                                                    type="button" className="add-point-btn" disabled={savingKey === workType}
                                                    onClick={() => saveGridRate(workType)}
                                                >
                                                    {savingKey === workType ? 'Saving…' : 'Save'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {quickAddOpen && (
                <QuickAddWorkModal url={url} projectId={projectId} onClose={() => setQuickAddOpen(false)} onCreated={handleWorkCreated} />
            )}
        </div>
    );
};

export default WorkTypeRatesManager;
