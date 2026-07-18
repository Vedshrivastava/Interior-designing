import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const GstSettingsForm = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [defaultGstRate, setDefaultGstRate] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/settings/company`, authHeader)
            .then(res => { if (res.data.success) setDefaultGstRate(res.data.data.defaultGstRate ?? ''); })
            .catch(() => toast.error('Error fetching GST settings'))
            .finally(() => setLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await axios.put(`${url}/api/finance/settings/company`, { defaultGstRate: defaultGstRate === '' ? null : Number(defaultGstRate) }, authHeader);
            if (res.data.success) toast.success(res.data.message);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error saving GST settings'); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;

    return (
        <form onSubmit={submit} className="flex-col" style={{ maxWidth: '360px' }}>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                Prefills (doesn't lock) the GST rate field on Running Bill generation and Purchase entry; still editable per document.
            </p>
            <div className="add-product-name flex-col">
                <p>Default GST Rate %</p>
                <input type="number" value={defaultGstRate} onChange={e => setDefaultGstRate(e.target.value)} placeholder="e.g. 18" />
            </div>
            <button type="submit" className="add-btn" disabled={saving} style={{ marginTop: '12px', alignSelf: 'flex-start' }}>
                {saving ? 'Saving…' : 'Save'}
            </button>
        </form>
    );
};

export default GstSettingsForm;
