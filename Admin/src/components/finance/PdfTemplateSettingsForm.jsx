import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';
import '../../styles/wizard.css';

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

    const submit = async () => {
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
        <div className="wizard-step-body">
            <p className="wizard-section-label">PDF Templates</p>
            <div className="wizard-field-grid">
                <div className="add-product-name flex-col wizard-field-full">
                    <p>Letterhead Footer Text</p>
                    <textarea rows="2" value={letterheadFooterText} onChange={e => setLetterheadFooterText(e.target.value)} placeholder="Shown at the bottom of the CA Monthly Package and Client Bill Statement PDFs" />
                </div>
            </div>
            <div className="wizard-actions">
                <span />
                <button type="button" className="add-btn" disabled={saving} onClick={submit}>
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    );
};

export default PdfTemplateSettingsForm;
