import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

/* Scoped deliberately to a footer line — not a full visual template
   editor. The brand palette (deep green + gold) is fixed in the PDF
   generation code, not admin-configurable. */
const PdfTemplateSettingsForm = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [letterheadFooterText, setLetterheadFooterText] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/settings/company`, authHeader)
            .then(res => {
                if (res.data.success) {
                    setLetterheadFooterText(res.data.data.letterheadFooterText || '');
                }
            })
            .catch(() => toast.error('Error fetching PDF template settings'))
            .finally(() => setLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await axios.put(`${url}/api/finance/settings/company`, { letterheadFooterText }, authHeader);
            if (res.data.success) toast.success(res.data.message);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error saving PDF template settings'); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;

    return (
        <form onSubmit={submit} className="flex-col" style={{ maxWidth: '480px' }}>
            <div className="add-product-name flex-col">
                <p>Letterhead Footer Text</p>
                <textarea rows="2" value={letterheadFooterText} onChange={e => setLetterheadFooterText(e.target.value)} placeholder="Shown at the bottom of the CA Monthly Package and Client Bill Statement PDFs" />
            </div>
            <button type="submit" className="add-btn" disabled={saving} style={{ marginTop: '12px', alignSelf: 'flex-start' }}>
                {saving ? 'Saving…' : 'Save'}
            </button>
        </form>
    );
};

export default PdfTemplateSettingsForm;
