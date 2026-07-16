import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import LabourPicker from './LabourPicker';
import StyledSelect from './StyledSelect';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { labourerId: '', workType: '', ratePerSqft: '' };

/* Manages financeLabourRate rows for one project — mirrors
   ContractorRatesManager, one row per (labourer, work type). Always
   per-sqft — labour has no per-day payment basis. */
const LabourRatesManager = ({ url, projectId, worksVersion }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [items, setItems] = useState([]);
    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    const [realWorkTypes, setRealWorkTypes] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/labour-rates/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error('Error fetching labour rates'); }
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

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.labourerId) { toast.error('Labourer is required'); return; }
        if (!form.workType.trim()) { toast.error('Work type is required'); return; }
        if (form.ratePerSqft === '') { toast.error('Rate is required'); return; }
        setSaving(true);
        try {
            const payload = { projectId, labourerId: form.labourerId, workType: form.workType.trim(), ratePerSqft: form.ratePerSqft };
            const res = await axios.post(`${url}/api/finance/labour-rates/add`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Labour rate added');
                setForm(emptyForm);
                await fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding labour rate');
        } finally { setSaving(false); }
    };

    const removeRate = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/labour-rates/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing labour rate'); }
    };

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                Assign labourers and add one rate row per work type each performs, per sqft.
            </p>

            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Labourer *</p>
                        <LabourPicker url={url} value={form.labourerId} onChange={v => setField('labourerId', v)} />
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
                        <p>Rate (₹/sqft) *</p>
                        <input type="number" value={form.ratePerSqft} onChange={e => setField('ratePerSqft', e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Adding…' : '+ Add Rate'}</button>
                </div>
            </form>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 100px' }}>
                    <b>Labourer</b><b>Work Type</b><b>Rate</b><b>Action</b>
                </div>
                {items.length === 0 ? (
                    <div className="admin-empty-state"><p>No labour rates yet.</p></div>
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

export default LabourRatesManager;
