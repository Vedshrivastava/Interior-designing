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

/* Manages financeContractorRate rows for one project — used in both the
   New Project wizard (Step 4) and the Project Detail page's Contractor
   Rates tab. A single contractor can have multiple rows on the same
   project, one per work type. `worksVersion` is only ever passed from the
   Project Detail page — used here to gate the "+ Add Work" quick-add
   dialog, same reasoning as WorkTypeRatesManager.jsx. */
const ContractorRatesManager = ({ url, projectId, worksVersion }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const allowQuickAddWork = worksVersion !== undefined;

    const [items, setItems] = useState([]);
    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    // null until this project has at least one real Work — orphan-flagging
    // only makes sense once there's something real to check against;
    // during setup (no Works yet) every rate is expected to look "unmatched".
    const [realWorkTypes, setRealWorkTypes] = useState(null);

    // Same idea, for contractors — who's actually assigned to a Work of a
    // given type on this project (from financeWorkContractorAssignment,
    // via GET /projects/:id's own `contractors` field), not the entire
    // vendor master. null until this project has at least one real
    // assignment; contractorsByWorkType maps workType -> the contractors
    // actually doing that work (a Work can have more than one contractor,
    // and a contractor can appear under more than one work type).
    const [realContractors, setRealContractors] = useState(null);
    const [contractorsByWorkType, setContractorsByWorkType] = useState(new Map());
    const [allProjectContractors, setAllProjectContractors] = useState([]);

    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [quickAddOpen, setQuickAddOpen] = useState(false);

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
    // work type they're assigned to (a contractor can do more than one
    // work type; a work type can have more than one contractor).
    const fetchProjectContractors = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/projects/${projectId}`, authHeader);
            if (!res.data.success) return;
            const contractors = res.data.data.contractors || [];
            if (!contractors.length) { setRealContractors(null); setContractorsByWorkType(new Map()); setAllProjectContractors([]); return; }

            const byType = new Map();
            for (const c of contractors) {
                for (const wt of c.workTypes) {
                    if (!byType.has(wt)) byType.set(wt, []);
                    byType.get(wt).push({ vendorId: c.vendorId, vendorName: c.vendorName });
                }
            }
            setContractorsByWorkType(byType);
            setAllProjectContractors(contractors.map(c => ({ vendorId: c.vendorId, vendorName: c.vendorName })));
            setRealContractors(new Set(contractors.map(c => c.vendorId)));
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

    // Contractors available for whichever work type is currently selected
    // — every real assignee if none is selected yet. Falls back to null
    // (handled at the call site) until this project has any assignment.
    const availableContractors = form.workType && contractorsByWorkType.has(form.workType)
        ? contractorsByWorkType.get(form.workType)
        : allProjectContractors;

    const setField = (key, value) => {
        setForm(prev => {
            const next = { ...prev, [key]: value };
            // Changing work type can invalidate a contractor picked for the
            // previous one — clear it rather than silently keep a mismatched
            // pairing the badge below would just flag right back anyway.
            if (key === 'workType' && realContractors && next.contractorVendorId) {
                const stillValid = (contractorsByWorkType.get(value) || allProjectContractors).some(c => c.vendorId === next.contractorVendorId);
                if (!stillValid) next.contractorVendorId = '';
            }
            return next;
        });
    };

    // Add-only, deliberately — once a rate is confirmed it shouldn't be
    // silently changed underneath work already measured/billed against it.
    // Remove and re-add if a rate was entered wrong.
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

    const removeRate = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/contractor-rates/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing contractor rate'); }
    };

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                Assign contractors and add one rate row per work type each performs. Required before this project can go active.
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
                        <p>Contractor *</p>
                        {realContractors ? (
                            <StyledSelect
                                value={form.contractorVendorId} onChange={v => setField('contractorVendorId', v)}
                                placeholder={availableContractors.length ? 'Select contractor…' : (form.workType ? 'No contractor assigned to this work type' : 'Select a work type first')}
                                options={availableContractors.map(c => ({ value: c.vendorId, label: c.vendorName }))}
                            />
                        ) : (
                            <ContractorOrLabourPicker url={url} value={form.contractorVendorId} onChange={v => setField('contractorVendorId', v)} />
                        )}
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

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 1fr 100px' }}>
                    <b>Contractor</b><b>Work Type</b><b>Basis</b><b>Rate</b><b>Action</b>
                </div>
                {items.length === 0 ? (
                    <div className="admin-empty-state"><p>No contractor rates yet.</p></div>
                ) : (
                    items.map(item => {
                        const isOrphaned = realWorkTypes && !realWorkTypes.has(item.workType);
                        const contractorId = item.contractorVendorId?._id || item.contractorVendorId;
                        const isContractorMismatched = !isOrphaned && realContractors
                            && !(contractorsByWorkType.get(item.workType) || []).some(c => c.vendorId === contractorId);
                        return (
                            <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 1fr 100px' }}>
                                <p>
                                    {item.contractorVendorId?.name || '—'}
                                    {isContractorMismatched && (
                                        <span
                                            className="item-category"
                                            style={{ marginLeft: '8px', background: 'rgba(192,57,43,0.12)', color: '#c0392b', borderColor: 'rgba(192,57,43,0.3)' }}
                                            title="This contractor isn't assigned to this work type on this project — check Works > Manage Contractors, or remove this rate."
                                        >
                                            ⚠ Not assigned to this work
                                        </span>
                                    )}
                                </p>
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
                                <p>{item.paymentBasis === 'per_sqft' ? 'Per Sqft' : 'Per Day'}</p>
                                <p>₹{item.paymentBasis === 'per_sqft' ? item.ratePerSqft : item.ratePerDay}</p>
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

export default ContractorRatesManager;
