import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const emptyForm = { vendorId: '', projectId: '', materialId: '', quantity: '', ratePerUnit: '', date: '', referenceNumber: '', notes: '' };

/*
 * Shared by Procurement's Purchases and Returns tabs — same fields, same
 * financePurchase model, just a different transactionType. Saving either
 * auto-creates the matching stock movement (dump for a purchase, return
 * for a return) server-side; nothing to trigger separately here.
 */
const PurchaseOrReturnManager = ({ url, transactionType }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const isReturn = transactionType === 'return';

    const [vendors, setVendors] = useState([]);
    const [projects, setProjects] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/purchases/list`, { ...authHeader, params: { transactionType } });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error(`Error fetching ${isReturn ? 'returns' : 'purchases'}`); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchItems(); }, [transactionType]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        axios.get(`${url}/api/finance/vendors/list`, authHeader).then(res => { if (res.data.success) setVendors(res.data.data.filter(v => v.vendorType !== 'labour_contractor')); }).catch(() => {});
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/materials/list`, authHeader).then(res => { if (res.data.success) setMaterials(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const totalPreview = (Number(form.quantity) || 0) * (Number(form.ratePerUnit) || 0);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.vendorId || !form.projectId || !form.materialId) return toast.error('Vendor, project, and material are required');
        if (!form.quantity || Number(form.quantity) <= 0) return toast.error('Quantity must be greater than zero');
        if (!form.ratePerUnit || Number(form.ratePerUnit) <= 0) return toast.error('Rate per unit must be greater than zero');
        if (!form.date) return toast.error('Date is required');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/purchases/add`, { ...form, transactionType }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); await fetchItems(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || `Error recording ${isReturn ? 'return' : 'purchase'}`); }
        finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/purchases/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchItems(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing'); }
        finally { setDeleting(false); }
    };

    return (
        <div>
            <form onSubmit={submit} style={{ marginBottom: '24px' }}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Vendor *</p>
                        <select value={form.vendorId} onChange={e => setField('vendorId', e.target.value)}>
                            <option value="">Select vendor…</option>
                            {vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                        </select>
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Project *</p>
                        <select value={form.projectId} onChange={e => setField('projectId', e.target.value)}>
                            <option value="">Select project…</option>
                            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Material *</p>
                        <select value={form.materialId} onChange={e => setField('materialId', e.target.value)}>
                            <option value="">Select material…</option>
                            {materials.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Quantity *</p>
                        <input type="number" value={form.quantity} onChange={e => setField('quantity', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Rate per Unit (₹) *</p>
                        <input type="number" value={form.ratePerUnit} onChange={e => setField('ratePerUnit', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Date *</p>
                        <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>{isReturn ? 'Return Reference' : 'PO Number'}</p>
                        <input type="text" value={form.referenceNumber} onChange={e => setField('referenceNumber', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Total (auto)</p>
                        <input type="text" value={`₹${totalPreview.toLocaleString('en-IN')}`} disabled />
                    </div>
                    <div className="add-product-name flex-col wizard-field-full">
                        <p>Notes</p>
                        <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : `Record ${isReturn ? 'Return' : 'Purchase'}`}</button>
                </div>
            </form>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr 1fr 1fr 1fr 100px' }}>
                    <b>Date</b><b>Vendor</b><b>Material</b><b>Qty</b><b>Rate</b><b>Total</b><b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : items.length === 0 ? (
                    <div className="admin-empty-state"><p>No {isReturn ? 'returns' : 'purchases'} recorded yet.</p></div>
                ) : (
                    items.map(item => (
                        <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr 1fr 1fr 1fr 100px' }}>
                            <p>{new Date(item.date).toLocaleDateString()}</p>
                            <p>{item.vendorId?.name || '—'}</p>
                            <p>{item.materialId?.name || '—'} {item.materialId?.unit ? `(${item.materialId.unit})` : ''}</p>
                            <p>{item.quantity}</p>
                            <p>₹{item.ratePerUnit}</p>
                            <p>₹{item.totalAmount.toLocaleString('en-IN')}</p>
                            <div className="action-buttons">
                                <p onClick={() => setConfirmItem(item)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {confirmItem && (
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this {isReturn ? 'return' : 'purchase'}?</h3>
                        <p className="bin-confirm-warning">Its stock movement is removed too — moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseOrReturnManager;
