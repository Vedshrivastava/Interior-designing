import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

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

    const submit = async (e) => {
        e.preventDefault();
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
        <form onSubmit={submit} className="flex-col" style={{ maxWidth: '480px' }}>
            <div className="add-product-name flex-col">
                <p>Notification Emails</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="owner@example.com" style={{ flex: 1 }} />
                    <button type="button" className="add-point-btn" onClick={addEmail}>+ Add</button>
                </div>
                {emails.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-lt)' }}>No notification emails yet.</p>
                ) : emails.map(email => (
                    <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                        <span>{email}</span>
                        <p onClick={() => removeEmail(email)} className="cursor delete-action" style={{ margin: 0 }}>X</p>
                    </div>
                ))}
            </div>

            <div className="add-product-name flex-col" style={{ marginTop: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={lowStockAlertEnabled} onChange={e => setLowStockAlertEnabled(e.target.checked)} />
                    Low stock alerts
                </label>
            </div>
            <div className="add-product-name flex-col">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={overdueReceivableAlertEnabled} onChange={e => setOverdueReceivableAlertEnabled(e.target.checked)} />
                    Overdue receivable alerts
                </label>
            </div>
            <div className="add-product-name flex-col">
                <p>Overdue threshold (days since oldest unpaid bill)</p>
                <input type="number" value={overdueReceivableDays} onChange={e => setOverdueReceivableDays(e.target.value)} />
            </div>

            <button type="submit" className="add-btn" disabled={saving} style={{ marginTop: '12px', alignSelf: 'flex-start' }}>
                {saving ? 'Saving…' : 'Save'}
            </button>
        </form>
    );
};

export default NotificationsSettingsForm;
