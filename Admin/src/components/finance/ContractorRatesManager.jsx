import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import ContractorOrLabourPicker from './ContractorOrLabourPicker';
import StyledSelect from './StyledSelect';
import QuickAddWorkModal from './QuickAddWorkModal';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { contractorVendorId: '', workType: '', paymentBasis: 'per_sqft', rate: '' };
const pairKey = (workType, vendorId) => `${workType}::${vendorId}`;

/* Manages financeContractorRate rows for one project — used in both the
   New Project wizard (Step 4) and the Project Detail page's Contractor
   Rates tab. `worksVersion` is only ever passed from the Project Detail
   page — used here to gate the "+ Add Work" quick-add dialog.

   Once the project has real Works, every (work type, contractor) pair is
   already fully determined by those Works' contractor assignments — there
   is nothing left to "select". So instead of a free-form add-rate form,
   this renders one row per real pair, grouped by work type: a saved rate
   shows read-only + Remove, an unset one shows an inline rate input. The
   old select-driven form only survives as the fallback for a project with
   no real Works yet (New Project Wizard Step 4), where there's genuinely
   nothing real to enumerate. */
const ContractorRatesManager = ({ url, projectId, worksVersion }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const allowQuickAddWork = worksVersion !== undefined;

    const [items, setItems] = useState([]);
    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    // null until this project has at least one real Work — orphan-flagging
    // (and the grid vs. fallback-form choice below) only makes sense once
    // there's something real to check against.
    const [realWorkTypes, setRealWorkTypes] = useState(null);

    // Who's actually assigned to a Work of a given type on this project
    // (from financeWorkContractorAssignment, via GET /projects/:id's own
    // `contractors` field) — not the entire vendor master. Map<workType,
    // Array<{vendorId, vendorName}>>; a Work can have more than one
    // contractor, and a contractor can appear under more than one work type.
    // Only meaningful once realWorkTypes is non-null (see fetchWorkTypeOptions) —
    // the fallback form below doesn't use this at all.
    const [contractorsByWorkType, setContractorsByWorkType] = useState(new Map());

    // Fallback-form state (only used when realWorkTypes === null).
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [quickAddOpen, setQuickAddOpen] = useState(false);

    // Grid state — pending basis/rate per unset (workType, vendorId) pair,
    // keyed by pairKey, and which key is currently being saved.
    const [pending, setPending] = useState({});
    const [savingKey, setSavingKey] = useState(null);

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/contractor-rates/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error('Error fetching contractor rates'); }
    };

    // A rate should only ever be settable for a work type this project
    // actually has a Work for — not free text. But the New Project wizard
    // sets these rates in Step 4, before any Work exists (Works only get
    // added later, from Project Detail) — so fall back to the Settings
    // master list until this project has at least one real Work.
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

    // project.contractors is computeProjectContractors' output — one row
    // per vendor actually assigned to >=1 Work here, each carrying every
    // work type they're assigned to.
    const fetchProjectContractors = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/projects/${projectId}`, authHeader);
            if (!res.data.success) return;
            const contractors = res.data.data.contractors || [];
            if (!contractors.length) { setContractorsByWorkType(new Map()); return; }

            const byType = new Map();
            for (const c of contractors) {
                for (const wt of c.workTypes) {
                    if (!byType.has(wt)) byType.set(wt, []);
                    byType.get(wt).push({ vendorId: c.vendorId, vendorName: c.vendorName });
                }
            }
            setContractorsByWorkType(byType);
        } catch { /* leave as-is */ }
    };

    useEffect(() => {
        if (projectId) { fetchList(); fetchWorkTypeOptions(); fetchProjectContractors(); }
    }, [projectId, worksVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleWorkCreated = async (newWork) => {
        setQuickAddOpen(false);
        await Promise.all([fetchWorkTypeOptions(), fetchProjectContractors()]);
        setForm(prev => ({ ...prev, workType: newWork.workType }));
    };

    // --- Fallback form (no real Works yet — nothing real to scope the
    // Contractor field to, so it stays the full company-wide picker) ---

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.contractorVendorId) { toast.error('Contractor is required'); return; }
        if (!form.workType.trim()) { toast.error('Work type is required'); return; }
        if (form.rate === '') { toast.error('Rate is required'); return; }
        setSaving(true);
        try {
            const payload = {
                projectId, contractorVendorId: form.contractorVendorId, workType: form.workType.trim(), paymentBasis: form.paymentBasis,
                ratePerSqft: form.paymentBasis === 'per_sqft' ? form.rate : 0,
                ratePerDay: form.paymentBasis === 'per_day' ? form.rate : 0,
            };
            const res = await axios.post(`${url}/api/finance/contractor-rates/add`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Contractor rate added');
                setForm(emptyForm);
                await fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding contractor rate');
        } finally { setSaving(false); }
    };

    // --- Grid (real Works exist) ---

    const setPendingField = (key, field, value) =>
        setPending(prev => ({ ...prev, [key]: { ...(prev[key] || { paymentBasis: 'per_sqft', rate: '' }), [field]: value } }));

    const saveGridRate = async (workType, contractorVendorId, key) => {
        const entry = pending[key] || { paymentBasis: 'per_sqft', rate: '' };
        if (entry.rate === '') { toast.error('Rate is required'); return; }
        setSavingKey(key);
        try {
            const payload = {
                projectId, contractorVendorId, workType, paymentBasis: entry.paymentBasis,
                ratePerSqft: entry.paymentBasis === 'per_sqft' ? entry.rate : 0,
                ratePerDay: entry.paymentBasis === 'per_day' ? entry.rate : 0,
            };
            const res = await axios.post(`${url}/api/finance/contractor-rates/add`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Rate saved');
                setPending(prev => { const next = { ...prev }; delete next[key]; return next; });
                await fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving rate');
        } finally { setSavingKey(null); }
    };

    const removeRate = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/contractor-rates/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing contractor rate'); }
    };

    const findExisting = (workType, vendorId) => items.find(i =>
        i.workType === workType && (i.contractorVendorId?._id || i.contractorVendorId) === vendorId);

    return (
        <div>
            {realWorkTypes === null ? (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                        Assign contractors and add one rate row per work type each performs. Required before this project can go active.
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
                                <p>Contractor *</p>
                                <ContractorOrLabourPicker url={url} value={form.contractorVendorId} onChange={v => setField('contractorVendorId', v)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Payment Basis *</p>
                                <select value={form.paymentBasis} onChange={e => setField('paymentBasis', e.target.value)}>
                                    <option value="per_sqft">Per Sqft</option>
                                    <option value="per_day">Per Day</option>
                                </select>
                            </div>
                            <div className="add-product-name flex-col">
                                <p>{form.paymentBasis === 'per_sqft' ? 'Rate (₹/sqft) *' : 'Rate (₹/day) *'}</p>
                                <input type="number" value={form.rate} onChange={e => setField('rate', e.target.value)} />
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
                        One row per contractor actually assigned to each work type — fill in a rate to confirm it.
                    </p>
                    <div className="list-table">
                        {[...contractorsByWorkType.entries()].map(([workType, contractors]) => (
                            <div key={workType}>
                                <div className="rate-group-header"><span className="rate-group-bar" /><b>{workType}</b></div>
                                {contractors.map(c => {
                                    const existing = findExisting(workType, c.vendorId);
                                    const key = pairKey(workType, c.vendorId);
                                    const entry = pending[key] || { paymentBasis: 'per_sqft', rate: '' };
                                    return (
                                        <div key={key} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 2.7fr' }}>
                                            <p>{c.vendorName}</p>
                                            <div className="rate-entry-row">
                                                {existing ? (
                                                    <>
                                                        <span className="rate-entry-saved">
                                                            ₹{existing.paymentBasis === 'per_sqft' ? existing.ratePerSqft : existing.ratePerDay} / {existing.paymentBasis === 'per_sqft' ? 'sqft' : 'day'}
                                                        </span>
                                                        <p onClick={() => removeRate(existing._id)} className="cursor delete-action" style={{ margin: 0 }}>Remove</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <select className="rate-entry-select" value={entry.paymentBasis} onChange={e => setPendingField(key, 'paymentBasis', e.target.value)}>
                                                            <option value="per_sqft">Per Sqft</option>
                                                            <option value="per_day">Per Day</option>
                                                        </select>
                                                        <input
                                                            type="number" className="rate-entry-input" placeholder="Rate ₹" value={entry.rate}
                                                            onChange={e => setPendingField(key, 'rate', e.target.value)}
                                                        />
                                                        <button
                                                            type="button" className="add-point-btn" disabled={savingKey === key}
                                                            onClick={() => saveGridRate(workType, c.vendorId, key)}
                                                        >
                                                            {savingKey === key ? 'Saving…' : 'Save'}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {quickAddOpen && (
                <QuickAddWorkModal url={url} projectId={projectId} onClose={() => setQuickAddOpen(false)} onCreated={handleWorkCreated} />
            )}
        </div>
    );
};

export default ContractorRatesManager;
