import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { teamId: '', workType: '', paymentBasis: 'per_sqft', rate: '' };

/* Manages financeTeamRate rows for one project — used in both the New
   Project wizard (Step 4) and the Project Detail page's Team Rates tab.
   A single team can have multiple rows on the same project, one per work type. */
const TeamRatesManager = ({ url, projectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [items, setItems] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/team-rates/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error('Error fetching team rates'); }
    };

    useEffect(() => { if (projectId) fetchList(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    // Add-only, deliberately — once a rate is confirmed it shouldn't be
    // silently changed underneath work already measured/billed against it.
    // Remove and re-add if a rate was entered wrong.
    const submit = async (e) => {
        e.preventDefault();
        if (!form.teamId) { toast.error('Team is required'); return; }
        if (!form.workType.trim()) { toast.error('Work type is required'); return; }
        if (form.rate === '') { toast.error('Rate is required'); return; }
        setSaving(true);
        try {
            const payload = {
                projectId, teamId: form.teamId, workType: form.workType.trim(), paymentBasis: form.paymentBasis,
                ratePerSqft: form.paymentBasis === 'per_sqft' ? form.rate : 0,
                ratePerDay: form.paymentBasis === 'per_day' ? form.rate : 0,
            };
            const res = await axios.post(`${url}/api/finance/team-rates/add`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Team rate added');
                setForm(emptyForm);
                await fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding team rate');
        } finally { setSaving(false); }
    };

    const removeRate = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/team-rates/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing team rate'); }
    };

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                Assign teams and add one rate row per work type each team performs. Required before this project can go active.
            </p>

            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Team *</p>
                        <QuickAddPicker url={url} resourceKey="teams" value={form.teamId} onChange={v => setField('teamId', v)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Work Type *</p>
                        <input type="text" placeholder="e.g. Putty" value={form.workType} onChange={e => setField('workType', e.target.value)} />
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
                    <b>Team</b><b>Work Type</b><b>Basis</b><b>Rate</b><b>Action</b>
                </div>
                {items.length === 0 ? (
                    <div className="admin-empty-state"><p>No team rates yet.</p></div>
                ) : (
                    items.map(item => (
                        <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 1fr 100px' }}>
                            <p>{item.teamId?.name || '—'}</p>
                            <p>{item.workType}</p>
                            <p>{item.paymentBasis === 'per_sqft' ? 'Per Sqft' : 'Per Day'}</p>
                            <p>₹{item.paymentBasis === 'per_sqft' ? item.ratePerSqft : item.ratePerDay}</p>
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

export default TeamRatesManager;
