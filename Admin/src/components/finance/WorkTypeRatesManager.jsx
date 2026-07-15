import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { workType: '', clientRate: '', referralRate: '' };

/* Manages financeWorkTypeRate rows for one project — used in both the New
   Project wizard (Step 3) and the Project Detail page's Work Type Rates tab. */
const WorkTypeRatesManager = ({ url, projectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [items, setItems] = useState([]);
    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/work-type-rates/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error('Error fetching work type rates'); }
    };

    useEffect(() => { if (projectId) fetchList(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'work_type' } })
            .then(res => { if (res.data.success) setWorkTypeOptions(res.data.data.map(s => s.name)); })
            .catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

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
                        <input type="text" list="work-type-options" placeholder="e.g. Putty" value={form.workType} onChange={e => setField('workType', e.target.value)} />
                        <datalist id="work-type-options">
                            {workTypeOptions.map(w => <option key={w} value={w} />)}
                        </datalist>
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
                    items.map(item => (
                        <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr 1fr 100px' }}>
                            <p>{item.workType}</p>
                            <p>₹{item.clientRatePerSqft}</p>
                            <p>₹{item.referralRatePerSqft}</p>
                            <div className="action-buttons">
                                <p onClick={() => removeRate(item._id)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default WorkTypeRatesManager;
