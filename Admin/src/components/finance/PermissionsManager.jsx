import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FINANCE_MODULE_OPTIONS } from '../../config/financeNav';
import '../../styles/list.css';
import '../../styles/add.css';

/* MASTER-only — which finance sidebar sections each ADMIN user can reach.
   Unset (every user by default) means full access, same as before this
   existed; MASTER always has full access regardless of this list. */
const PermissionsManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editingModules, setEditingModules] = useState([]);
    const [saving, setSaving] = useState(false);

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/settings/permissions`, authHeader);
            if (res.data.success) setAdmins(res.data.data);
        } catch { toast.error('Error fetching admin permissions'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAdmins(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const startEdit = (admin) => {
        setEditingId(admin._id);
        setEditingModules(Array.isArray(admin.allowedFinanceModules) ? admin.allowedFinanceModules : []);
    };
    const cancelEdit = () => { setEditingId(null); setEditingModules([]); };

    const toggleModule = (key) => setEditingModules(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

    const saveRestricted = async (userId) => {
        setSaving(true);
        try {
            const res = await axios.put(`${url}/api/finance/settings/permissions`, { userId, allowedFinanceModules: editingModules }, authHeader);
            if (res.data.success) { toast.success(res.data.message); cancelEdit(); await fetchAdmins(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error saving permissions'); }
        finally { setSaving(false); }
    };

    const clearRestriction = async (userId) => {
        setSaving(true);
        try {
            const res = await axios.put(`${url}/api/finance/settings/permissions`, { userId, allowedFinanceModules: null }, authHeader);
            if (res.data.success) { toast.success('Full access restored'); await fetchAdmins(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error clearing restriction'); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (admins.length === 0) return <div className="admin-empty-state"><p>No ADMIN users yet.</p></div>;

    return (
        <div className="dash-chart-card prm-card">
            <div className="prm-row prm-header">
                <b className="prm-admin">Admin</b>
                <b className="prm-access">Access</b>
                <b className="prm-action">Action</b>
            </div>
            {admins.map(a => {
                const isRestricted = Array.isArray(a.allowedFinanceModules);
                const isEditing = editingId === a._id;

                if (isEditing) {
                    return (
                        <div key={a._id} className="prm-row permissions-edit-row">
                            <div className="permissions-edit-header pq-section-header">
                                <p>{a.name}<br /><span style={{ fontSize: '0.8rem', color: 'var(--text-lt)' }}>{a.email}</span></p>
                                <div className="action-buttons">
                                    <p onClick={() => saveRestricted(a._id)} className="cursor edit-action">{saving ? 'Saving…' : 'Save'}</p>
                                    <p onClick={cancelEdit} className="cursor delete-action">Cancel</p>
                                </div>
                            </div>
                            <div className="add-multi-section flex-col">
                                <p>Allowed modules <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#888' }}>(saving with none selected blocks this admin from every finance section — use Clear afterward to restore full access)</span></p>
                                <div className="add-multi-grid">
                                    {FINANCE_MODULE_OPTIONS.map(m => {
                                        const sel = editingModules.includes(m.key);
                                        return (
                                            <button key={m.key} type="button"
                                                className={`add-multi-chip${sel ? ' active' : ''}`}
                                                onClick={() => toggleModule(m.key)}>
                                                {m.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                }

                return (
                    <div key={a._id} className="prm-row">
                        <p className="prm-admin">{a.name}<br /><span style={{ fontSize: '0.8rem', color: 'var(--text-lt)' }}>{a.email}</span></p>
                        <p className="prm-access"><span className="pq-group-label">Access</span>{isRestricted ? `${a.allowedFinanceModules.length} module(s)` : 'Full access'}</p>
                        <div className="prm-action">
                            <p onClick={() => startEdit(a)} className="cursor edit-action">Edit</p>
                            {isRestricted && <p onClick={() => clearRestriction(a._id)} className="cursor delete-action">Clear</p>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default PermissionsManager;
