import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import '../../styles/list.css';

const emptyForm = {
    companyName: '', address: '', gstin: '', pan: '', phone: '', email: '',
    authorizedSignatoryName: '', defaultSacCode: '', primaryBankAccountId: '', logoUrl: '',
};

/* Company profile — one tab of several all editing the same
   financeCompanySettings singleton (see SettingsPage.jsx). Only sends the
   fields this tab owns; the backend only applies keys actually present in
   the request body, so this can never clobber another tab's fields.

   Every field here (GSTIN, PAN, phone, email, signatory, payment account)
   is what every Bill/Receipt/Statement PDF pulls its branding and payment
   details from — see Backend/utils/pdfLetterhead.js. Nothing shows on a
   document until it's filled in here; leaving a field blank omits that
   line entirely rather than printing something empty. */
const CompanySettingsForm = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [form, setForm] = useState(emptyForm);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [logoFile, setLogoFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/settings/company`, authHeader);
            if (res.data.success) {
                const d = res.data.data;
                setForm({
                    companyName: d.companyName || '', address: d.address || '', gstin: d.gstin || '', pan: d.pan || '',
                    phone: d.phone || '', email: d.email || '',
                    authorizedSignatoryName: d.authorizedSignatoryName || '', defaultSacCode: d.defaultSacCode || '',
                    primaryBankAccountId: d.primaryBankAccountId?._id || '',
                    logoUrl: d.logoUrl || '',
                });
            }
        } catch { toast.error('Error fetching company settings'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchSettings(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.companyName.trim()) return toast.error('Company name is required');
        setSaving(true);
        try {
            const data = new FormData();
            data.append('companyName', form.companyName);
            data.append('address', form.address);
            data.append('gstin', form.gstin);
            data.append('pan', form.pan);
            data.append('phone', form.phone);
            data.append('email', form.email);
            data.append('authorizedSignatoryName', form.authorizedSignatoryName);
            data.append('defaultSacCode', form.defaultSacCode);
            data.append('primaryBankAccountId', form.primaryBankAccountId);
            if (logoFile) data.append('logo', logoFile);
            const res = await axios.put(`${url}/api/finance/settings/company`, data, {
                headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) { toast.success(res.data.message); setLogoFile(null); await fetchSettings(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error saving company settings'); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;

    return (
        <form onSubmit={submit} className="flex-col" style={{ maxWidth: '480px' }}>
            <div className="add-product-name flex-col">
                <p>Company Name *</p>
                <input type="text" value={form.companyName} onChange={e => setField('companyName', e.target.value)} />
            </div>
            <div className="add-product-name flex-col">
                <p>Address</p>
                <textarea rows="2" value={form.address} onChange={e => setField('address', e.target.value)} />
            </div>
            <div className="add-product-name flex-col">
                <p>GSTIN</p>
                <input type="text" value={form.gstin} onChange={e => setField('gstin', e.target.value)} />
            </div>
            <div className="add-product-name flex-col">
                <p>PAN</p>
                <input type="text" value={form.pan} onChange={e => setField('pan', e.target.value)} />
            </div>
            <div className="add-product-name flex-col">
                <p>Phone</p>
                <input type="text" value={form.phone} onChange={e => setField('phone', e.target.value)} />
            </div>
            <div className="add-product-name flex-col">
                <p>Email</p>
                <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} />
            </div>
            <div className="add-product-name flex-col">
                <p>Payment Account (shown as "Pay To" on Bills & Receipts)</p>
                <StyledSelect
                    value={form.primaryBankAccountId} onChange={v => setField('primaryBankAccountId', v)} placeholder="None"
                    options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                />
            </div>
            <div className="add-product-name flex-col">
                <p>Default SAC Code</p>
                <input type="text" value={form.defaultSacCode} onChange={e => setField('defaultSacCode', e.target.value)} placeholder="e.g. 995461" />
                <p className="admin-subtitle" style={{ margin: '4px 0 0' }}>Printed once near the GST total on Bill Statements — leave blank to omit.</p>
            </div>
            <div className="add-product-name flex-col">
                <p>Authorized Signatory Name</p>
                <input type="text" value={form.authorizedSignatoryName} onChange={e => setField('authorizedSignatoryName', e.target.value)} />
                <p className="admin-subtitle" style={{ margin: '4px 0 0' }}>Adds a signature line to Bills & Receipts — leave blank to omit.</p>
            </div>
            <div className="add-product-name flex-col">
                <p>Logo</p>
                {form.logoUrl && <img src={form.logoUrl} alt="Company logo" style={{ height: '48px', marginBottom: '8px' }} />}
                <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0] || null)} />
            </div>
            <button type="submit" className="add-btn" disabled={saving} style={{ marginTop: '12px', alignSelf: 'flex-start' }}>
                {saving ? 'Saving…' : 'Save'}
            </button>
        </form>
    );
};

export default CompanySettingsForm;
