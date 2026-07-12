import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

/* Manages financeWorkTypeRate rows for one project — used in both the New
   Project wizard (Step 3) and the Project Detail page's Work Type Rates tab. */
const WorkTypeRatesManager = ({ url, projectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [items, setItems] = useState([]);
    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    const [workType, setWorkType] = useState('');
    const [clientRate, setClientRate] = useState('');
    const [referralRate, setReferralRate] = useState('');
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

    const addRate = async (e) => {
        e.preventDefault();
        if (!workType.trim()) { toast.error('Work type is required'); return; }
        if (clientRate === '') { toast.error('Client rate is required'); return; }
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/work-type-rates/add`, {
                projectId, workType: workType.trim(), clientRatePerSqft: clientRate, referralRatePerSqft: referralRate || 0,
            }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                setWorkType(''); setClientRate(''); setReferralRate('');
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

            <form onSubmit={addRate} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <input type="text" list="work-type-options" placeholder="Work type (e.g. Putty)"
                    value={workType} onChange={e => setWorkType(e.target.value)} style={{ flex: 2, minWidth: '160px' }} />
                <datalist id="work-type-options">
                    {workTypeOptions.map(w => <option key={w} value={w} />)}
                </datalist>
                <input type="number" placeholder="Client rate ₹/sqft" value={clientRate} onChange={e => setClientRate(e.target.value)} style={{ flex: 1, minWidth: '140px' }} />
                <input type="number" placeholder="Referral rate ₹/sqft" value={referralRate} onChange={e => setReferralRate(e.target.value)} style={{ flex: 1, minWidth: '140px' }} />
                <button type="submit" className="add-point-btn" disabled={saving}>{saving ? 'Adding…' : '+ Add Rate'}</button>
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
