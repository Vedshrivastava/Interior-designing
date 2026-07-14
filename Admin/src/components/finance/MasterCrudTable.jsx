import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FINANCE_MASTERS } from '../../config/financeMasters';
import { registerSettingIfNew } from './SettingSelectField';
import { emptyFormFromFields, renderMasterField } from './masterFieldRenderer';
import '../../styles/list.css';
import '../../styles/add.css';

/* Generic add/list/edit/delete table for the simple Phase 0 masters
   (Clients, Vendors, Employees, Materials, Labour Teams) — one config-driven
   component instead of five near-identical bespoke pages.

   `filter` (optional): client-side predicate applied to the fetched list
   before rendering — used by Procurement/Contractors to show the same
   Vendors data split by vendorType without a second API endpoint.

   `getDetailLink` (optional): (item) => path — when set, the first column
   renders as a clickable link into a detail route (used by Clients). */
const MasterCrudTable = ({ url, resourceKey, filter, getDetailLink }) => {
    const navigate = useNavigate();
    const resource = FINANCE_MASTERS[resourceKey];
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [vendors, setVendors] = useState([]);
    const [settingOptions, setSettingOptions] = useState({}); // { [settingType]: [{_id, name}] }
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(emptyFormFromFields(resource.fields));
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Only needed for the read-only column display (e.g. Team's Contractor
    // column) — the form itself no longer needs a pre-fetched vendor list,
    // since vendorSelect fields render as a self-fetching QuickAddPicker.
    const needsVendors = resource.columns.some(c => c.vendorRef);
    const settingSelectFields = resource.fields.filter(f => f.type === 'settingSelect');

    const fetchList = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}${resource.apiBase}/list`, authHeader);
            if (res.data.success) setList(res.data.data);
        } catch {
            toast.error(`Error fetching ${resource.labelPlural.toLowerCase()}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchList(); }, [resourceKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!needsVendors) return;
        axios.get(`${url}/api/finance/vendors/list`, authHeader)
            .then(res => { if (res.data.success) setVendors(res.data.data); })
            .catch(() => {});
    }, [needsVendors]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        settingSelectFields.forEach(f => {
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: f.settingType } })
                .then(res => { if (res.data.success) setSettingOptions(prev => ({ ...prev, [f.settingType]: res.data.data })); })
                .catch(() => {});
        });
    }, [resourceKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const vendorName = (id) => vendors.find(v => v._id === (id?._id || id))?.name || '—';

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyFormFromFields(resource.fields));
        setModalOpen(true);
    };

    const openEdit = (item) => {
        setEditingId(item._id);
        const next = emptyFormFromFields(resource.fields);
        resource.fields.forEach(f => {
            let v = item[f.key];
            if (f.type === 'vendorSelect') v = v?._id || v || '';
            if (f.type === 'date' && v) v = new Date(v).toISOString().slice(0, 10);
            next[f.key] = v ?? next[f.key];
        });
        setForm(next);
        setModalOpen(true);
    };

    const closeModal = () => { setModalOpen(false); setEditingId(null); };

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        const requiredField = resource.fields.find(f => f.required && !String(form[f.key] || '').trim());
        if (requiredField) { toast.error(`${requiredField.label} is required`); return; }

        setSaving(true);
        try {
            const payload = editingId ? { ...form, _id: editingId } : form;
            const endpoint = editingId ? 'update' : 'add';
            const res = await axios.post(`${url}${resource.apiBase}/${endpoint}`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || `${resource.label} saved`);
                await Promise.all(settingSelectFields.map(f =>
                    registerSettingIfNew(url, authHeader, f.settingType, form[f.key], settingOptions[f.settingType] || [])
                ));
                closeModal();
                await fetchList();
            } else {
                toast.error(res.data.message);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || `Error saving ${resource.label.toLowerCase()}`);
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.post(`${url}${resource.apiBase}/remove`, { _id: confirmItem._id }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                setConfirmItem(null);
                await fetchList();
            } else {
                toast.error(res.data.message);
            }
        } catch {
            toast.error(`Error removing ${resource.label.toLowerCase()}`);
        } finally {
            setDeleting(false);
        }
    };

    const renderCell = (item, col, isFirst) => {
        const value = item[col.key];
        let content;
        if (col.vendorRef) content = vendorName(value);
        else if (col.joinArray) content = Array.isArray(value) && value.length > 0 ? value.join(', ') : '—';
        else if (col.badge) {
            const opt = resource.fields.find(f => f.key === col.key)?.options?.find(o => o.value === value);
            content = value ? <span className="item-category">{opt?.label || value}</span> : '—';
        } else content = value || '—';

        if (isFirst && getDetailLink) {
            return <span className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate(getDetailLink(item))}>{content}</span>;
        }
        return content;
    };

    const displayList = filter ? list.filter(filter) : list;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button type="button" className="add-point-btn" onClick={openAdd}>+ Add {resource.label}</button>
            </div>

            <div className="list-table">
                <div className="list-table-format title"
                    style={{ gridTemplateColumns: `repeat(${resource.columns.length}, 1fr) 140px` }}>
                    {resource.columns.map(c => <b key={c.key}>{c.label}</b>)}
                    <b>Action</b>
                </div>

                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : displayList.length === 0 ? (
                    <div className="admin-empty-state"><p>No {resource.labelPlural.toLowerCase()} yet.</p></div>
                ) : (
                    displayList.map(item => (
                        <div key={item._id} className="list-table-format row-item"
                            style={{ gridTemplateColumns: `repeat(${resource.columns.length}, 1fr) 140px` }}>
                            {resource.columns.map((c, i) => <p key={c.key}>{renderCell(item, c, i === 0)}</p>)}
                            <div className="action-buttons">
                                <p onClick={() => openEdit(item)} className="cursor edit-action">Edit</p>
                                <p onClick={() => setConfirmItem(item)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>{editingId ? `Edit ${resource.label}` : `Add ${resource.label}`}</h2>
                        <form className="flex-col" onSubmit={submit}>
                            {resource.fields.filter(f => !f.showIf || f.showIf(form)).map(f => (
                                <div key={f.key} className="add-product-name flex-col">
                                    <p>{f.label}{f.required ? ' *' : ''}</p>
                                    {renderMasterField(f, form, setField, { url, settingOptions })}
                                </div>
                            ))}
                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove {resource.label}?</h3>
                        <p className="bin-confirm-name">"{confirmItem.name}"</p>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmDelete} disabled={deleting}>
                                {deleting ? 'Removing…' : 'Yes, Remove'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default MasterCrudTable;
