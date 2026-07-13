import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const FinancialYearForm = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [fyStartMonth, setFyStartMonth] = useState(4);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/settings/company`, authHeader)
            .then(res => { if (res.data.success) setFyStartMonth(res.data.data.fyStartMonth || 4); })
            .catch(() => toast.error('Error fetching financial year settings'))
            .finally(() => setLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await axios.put(`${url}/api/finance/settings/company`, { fyStartMonth }, authHeader);
            if (res.data.success) toast.success(res.data.message);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error saving financial year settings'); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;

    return (
        <form onSubmit={submit} className="flex-col" style={{ maxWidth: '360px' }}>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                Reports' "This FY" date-range filters aren't wired to this yet — a small follow-up once this is set.
            </p>
            <div className="add-product-name flex-col">
                <p>Financial Year Starts</p>
                <select value={fyStartMonth} onChange={e => setFyStartMonth(Number(e.target.value))}>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
            </div>
            <button type="submit" className="add-btn" disabled={saving} style={{ marginTop: '12px', alignSelf: 'flex-start' }}>
                {saving ? 'Saving…' : 'Save'}
            </button>
        </form>
    );
};

export default FinancialYearForm;
