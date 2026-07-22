import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';
import '../../styles/wizard.css';

/* Email list + the two alert toggles/threshold — checked on Dashboard
   load (see FinanceHome.jsx), not a background job; no cron
   infrastructure exists in this codebase. */
const NotificationsSettingsForm = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [emails, setEmails] = useState([]);
    const [newEmail, setNewEmail] = useState('');
    const [lowStockAlertEnabled, setLowStockAlertEnabled] = useState(false);
    const [overdueReceivableAlertEnabled, setOverdueReceivableAlertEnabled] = useState(false);
    const [overdueReceivableDays, setOverdueReceivableDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/settings/notifications`, authHeader);
            if (res.data.success) {
                const d = res.data.data;
                setEmails(d.notificationEmails || []);
                setLowStockAlertEnabled(!!d.lowStockAlertEnabled);
                setOverdueReceivableAlertEnabled(!!d.overdueReceivableAlertEnabled);
                setOverdueReceivableDays(d.overdueReceivableDays ?? 30);
            }
        } catch { toast.error('Error fetching notification settings'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchSettings(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const addEmail = () => {
        const trimmed = newEmail.trim();
        if (!trimmed) return;
        if (emails.includes(trimmed)) return toast.error('Already in the list');
        setEmails(prev => [...prev, trimmed]);
        setNewEmail('');
    };
    const removeEmail = (email) => setEmails(prev => prev.filter(e => e !== email));

    const submit = async () => {
        setSaving(true);
        try {
            const res = await axios.put(`${url}/api/finance/settings/notifications`, {
                notificationEmails: emails, lowStockAlertEnabled, overdueReceivableAlertEnabled,
                overdueReceivableDays: Number(overdueReceivableDays),
            }, authHeader);
            if (res.data.success) toast.success(res.data.message);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error saving notification settings'); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;

    return (
        <div className="wizard-step-body">
            <p className="wizard-section-label">Recipients</p>
            <div className="wizard-field-grid">
                <div className="add-product-name flex-col wizard-field-full">
                    <p>Add Notification Email</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="owner@example.com" style={{ flex: 1 }} />
                        <button type="button" className="add-point-btn" onClick={addEmail}>+ Add</button>
                    </div>
                </div>
            </div>

            {emails.length === 0 ? (
                <div className="admin-empty-state" style={{ marginBottom: '20px' }}><p>No notification emails yet.</p></div>
            ) : (
                <div className="list-table finance-table" style={{ marginBottom: '20px' }}>
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 100px' }}>
                        <b>Email</b><b>Action</b>
                    </div>
                    {emails.map(email => (
                        <div key={email} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 100px' }}>
                            <p>{email}</p>
                            <div className="action-buttons">
                                <p onClick={() => removeEmail(email)} className="cursor delete-action">Remove</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p className="wizard-section-label">Alerts</p>
            <div className="wizard-field-grid">
                <div className="add-product-name flex-col">
                    <p>Low Stock</p>
                    <label className="featured-toggle" style={{ margin: 0, display: 'flex' }}>
                        <input type="checkbox" checked={lowStockAlertEnabled} onChange={e => setLowStockAlertEnabled(e.target.checked)} />
                        <span className="toggle-slider"></span>
                        <span className="toggle-label">Alert when a material falls below its minimum stock level</span>
                    </label>
                </div>
                <div className="add-product-name flex-col">
                    <p>Overdue Receivables</p>
                    <label className="featured-toggle" style={{ margin: 0, display: 'flex' }}>
                        <input type="checkbox" checked={overdueReceivableAlertEnabled} onChange={e => setOverdueReceivableAlertEnabled(e.target.checked)} />
                        <span className="toggle-slider"></span>
                        <span className="toggle-label">Alert on unpaid bills past the threshold below</span>
                    </label>
                </div>
                <div className="add-product-name flex-col">
                    <p>Overdue Threshold (days since oldest unpaid bill)</p>
                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={overdueReceivableDays} onChange={e => setOverdueReceivableDays(e.target.value)} />
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

export default NotificationsSettingsForm;
