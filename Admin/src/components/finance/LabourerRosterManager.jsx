import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const emptyForm = { name: '', notes: '' };

/*
 * One supervisor's roster of named labourers, hired directly by the
 * company. Rate lives per project + work type (LabourRatesManager, set
 * from a project's Labour tab), not here — a labourer can earn
 * differently across projects and work types.
 */
const LabourerRosterManager = ({ url, supervisorId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [labourers, setLabourers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);

    const fetchLabourers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/labourers/list`, { ...authHeader, params: { supervisorId } });
            if (res.data.success) setLabourers(res.data.data);
        } catch { toast.error('Error fetching roster'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (supervisorId) fetchLabourers(); }, [supervisorId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const startEdit = (l) => { setEditingId(l._id); setForm({ name: l.name, notes: l.notes || '' }); };
    const cancelEdit = () => { setEditingId(null); setForm(emptyForm); };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error('Name is required');
        setSaving(true);
        try {
            const endpoint = editingId ? 'update' : 'add';
            const payload = editingId ? { ...form, _id: editingId } : { ...form, supervisorId };
            const res = await axios.post(`${url}/api/finance/labourers/${endpoint}`, payload, authHeader);
            if (res.data.success) { toast.success(res.data.message); cancelEdit(); await fetchLabourers(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error saving labourer'); }
        finally { setSaving(false); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.post(`${url}/api/finance/labourers/remove`, { _id: id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchLabourers(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing labourer'); }
    };

    return (
        <div>
            <form onSubmit={submit} style={{ marginBottom: '24px' }}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Name *</p>
                        <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col wizard-field-full">
                        <p>Notes</p>
                        <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    {editingId && <button type="button" className="add-btn cancel-btn" onClick={cancelEdit}>Cancel</button>}
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save Changes' : '+ Add Labourer'}</button>
                </div>
            </form>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 2fr 140px' }}>
                    <b>Name</b><b>Notes</b><b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : labourers.length === 0 ? (
                    <div className="admin-empty-state"><p>No labourers on this supervisor's roster yet.</p></div>
                ) : labourers.map(l => (
                    <div key={l._id} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 2fr 140px' }}>
                        <p>{l.name}</p>
                        <p>{l.notes || '—'}</p>
                        <div className="action-buttons">
                            <p onClick={() => startEdit(l)} className="cursor edit-action">Edit</p>
                            <p onClick={() => remove(l._id)} className="cursor delete-action">X</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LabourerRosterManager;
