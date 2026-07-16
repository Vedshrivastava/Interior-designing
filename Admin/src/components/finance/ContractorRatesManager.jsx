import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import ContractorOrLabourPicker from './ContractorOrLabourPicker';
import StyledSelect from './StyledSelect';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { contractorVendorId: '', workType: '', paymentBasis: 'per_sqft', rate: '' };

/* Manages financeContractorRate rows for one project — used in both the
   New Project wizard (Step 4) and the Project Detail page's Contractor
   Rates tab. A single contractor can have multiple rows on the same
   project, one per work type. */
const ContractorRatesManager = ({ url, projectId, worksVersion }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [items, setItems] = useState([]);
    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    // null until this project has at least one real Work — orphan-flagging
    // only makes sense once there's something real to check against;
    // during setup (no Works yet) every rate is expected to look "unmatched".
    const [realWorkTypes, setRealWorkTypes] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

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

    useEffect(() => { if (projectId) { fetchList(); fetchWorkTypeOptions(); } }, [projectId, worksVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

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
                        <p>Contractor *</p>
                        <ContractorOrLabourPicker url={url} value={form.contractorVendorId} onChange={v => setField('contractorVendorId', v)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Work Type *</p>
                        <StyledSelect
                            value={form.workType} onChange={v => setField('workType', v)}
                            placeholder={workTypeOptions.length ? 'Select work type…' : 'Add a Work first'}
                            options={workTypeOptions.map(w => ({ value: w, label: w }))}
                        />
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
                        return (
                            <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 1fr 100px' }}>
                                <p>{item.contractorVendorId?.name || '—'}</p>
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
        </div>
    );
};

export default ContractorRatesManager;
