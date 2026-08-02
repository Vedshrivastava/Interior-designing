import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import '../../styles/list.css';
import '../../styles/dashboard.css';

const emptyForm = { vendorId: '', projectId: '', materialId: '', quantity: '', ratePerUnit: '', date: '', referenceNumber: '', notes: '', gstRate: '' };

/*
 * Shared by Procurement's Purchases and Returns tabs — same fields, same
 * financePurchase model, just a different transactionType. Saving either
 * auto-creates the matching stock movement (dump for a purchase, return
 * for a return) server-side; nothing to trigger separately here.
 */
const PurchaseOrReturnManager = ({ url, transactionType, defaultProjectId, defaultMaterialId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const isReturn = transactionType === 'return';

    const [vendors, setVendors] = useState([]);
    const [projects, setProjects] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState({ ...emptyForm, projectId: defaultProjectId || '', materialId: defaultMaterialId || '' });
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(!!(defaultProjectId || defaultMaterialId));
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

    const fetchPickerData = () => {
        axios.get(`${url}/api/finance/vendors/list`, authHeader).then(res => { if (res.data.success) setVendors(res.data.data.filter(v => v.vendorType !== 'labour_contractor')); }).catch(() => {});
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/materials/list`, authHeader).then(res => { if (res.data.success) setMaterials(res.data.data); }).catch(() => {});
    };
    useEffect(() => {
        fetchPickerData();
        // Prefill (not lock) gstRate from Settings > GST — only if the form
        // hasn't already been touched by the time this resolves.
        axios.get(`${url}/api/finance/settings/company`, authHeader).then(res => {
            const rate = res.data.success ? res.data.data.defaultGstRate : null;
            if (rate !== null && rate !== undefined) setForm(prev => (prev.gstRate === '' ? { ...prev, gstRate: rate } : prev));
        }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    // Without this, a project/vendor/material deleted (or added) elsewhere
    // kept showing (or missing) here as a pickable option until a full page
    // reload — including letting a new purchase get recorded against an
    // already-deleted project.
    useFinanceWsRefresh(['financeProjectsChanged', 'financeVendorsChanged', 'financeMaterialsChanged'], fetchPickerData);

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const totalPreview = (Number(form.quantity) || 0) * (Number(form.ratePerUnit) || 0);
    const selectedMaterial = materials.find(m => m._id === form.materialId);
    const rateLabel = selectedMaterial?.unit ? `Rate per ${selectedMaterial.unit} (₹) *` : 'Rate per Unit (₹) *';

    const submit = async (e) => {
        e.preventDefault();
        if (!form.vendorId || !form.projectId || !form.materialId) return toast.error('Vendor, project, and material are required');
        if (!form.quantity || Number(form.quantity) <= 0) return toast.error('Quantity must be greater than zero');
        if (!form.ratePerUnit || Number(form.ratePerUnit) <= 0) return toast.error('Rate per unit must be greater than zero');
        if (!form.date) return toast.error('Date is required');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/purchases/add`, { ...form, transactionType }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setForm(emptyForm); setModalOpen(false); await fetchItems(); }
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
            <div className="pq-section-header">
                <h3 style={{ margin: 0 }}>{isReturn ? 'Returns' : 'Purchases'}</h3>
                <button type="button" className="add-btn" onClick={() => setModalOpen(true)}>{`+ Record ${isReturn ? 'Return' : 'Purchase'}`}</button>
            </div>
            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : items.length === 0 ? (
                <div className="admin-empty-state"><p>No {isReturn ? 'returns' : 'purchases'} recorded yet.</p></div>
            ) : (
                <div className="dash-chart-card por-card">
                    <div className="por-row por-header">
                        <b className="por-date">Date</b>
                        <b className="por-vendor">Vendor</b>
                        <b className="por-material">Material</b>
                        <b className="por-qty">Qty</b>
                        <b className="por-rate">Rate</b>
                        <b className="por-total">Total</b>
                        <b className="por-gst">GST</b>
                        <b className="por-actions">Action</b>
                    </div>
                    {items.map(item => (
                        <div key={item._id} className="por-row">
                            <p className="por-date"><span className="pq-group-label">Date</span>{new Date(item.date).toLocaleDateString()}</p>
                            <p className="por-vendor">{item.vendorId?.name || '-'}</p>
                            <p className="por-material"><span className="pq-group-label">Material</span>{item.materialId?.name || '-'} {item.materialId?.unit ? `(${item.materialId.unit})` : ''}</p>
                            <p className="por-qty"><span className="pq-group-label">Qty</span>{item.quantity} {item.materialId?.unit || ''}</p>
                            <p className="por-rate"><span className="pq-group-label">Rate</span>₹{item.ratePerUnit}{item.materialId?.unit ? `/${item.materialId.unit}` : ''}</p>
                            <p className="por-total"><span className="pq-group-label">Total</span>₹{item.totalAmount.toLocaleString('en-IN')}</p>
                            <p className="por-gst"><span className="pq-group-label">GST</span>{item.gstAmount ? `₹${item.gstAmount.toLocaleString('en-IN')} (${item.gstRate}%)` : '-'}</p>
                            <div className="action-buttons por-actions">
                                <button type="button" onClick={() => setConfirmItem(item)} className="pq-btn-ghost-danger" title={`Remove ${isReturn ? 'return' : 'purchase'}`} aria-label={`Remove ${isReturn ? 'return' : 'purchase'}`}>
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay por-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal por-modal">
                        <div className="por-modal-header">
                            <h2>{`Record ${isReturn ? 'Return' : 'Purchase'}`}</h2>
                        </div>
                        <div className="por-modal-body">
                        <form id="purchase-or-return-form" onSubmit={submit}>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Vendor *</p>
                                    <StyledSelect value={form.vendorId} onChange={v => setField('vendorId', v)} placeholder="Select vendor…"
                                        options={vendors.map(v => ({ value: v._id, label: v.name }))} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Project *</p>
                                    <StyledSelect value={form.projectId} onChange={v => setField('projectId', v)} placeholder="Select project…"
                                        options={projects.map(p => ({ value: p._id, label: p.name }))} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Material *</p>
                                    <StyledSelect value={form.materialId} onChange={v => setField('materialId', v)} placeholder="Select material…"
                                        options={materials.map(m => ({ value: m._id, label: m.unit ? `${m.name} (${m.unit})` : m.name }))} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Quantity{selectedMaterial?.unit ? ` (${selectedMaterial.unit})` : ''} *</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.quantity} onChange={e => setField('quantity', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>{rateLabel}</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.ratePerUnit} onChange={e => setField('ratePerUnit', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Date *</p>
                                    <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>{isReturn ? 'Return Reference' : 'PO Number'}</p>
                                    <input type="text" value={form.referenceNumber} onChange={e => setField('referenceNumber', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Total (auto)</p>
                                    <input type="text" value={`₹${totalPreview.toLocaleString('en-IN')}`} disabled />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>GST Rate % (optional)</p>
                                    <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.gstRate} onChange={e => setField('gstRate', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Notes</p>
                                    <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                                </div>
                            </div>
                        </form>
                        </div>
                        <div className="edit-modal-actions por-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button type="submit" form="purchase-or-return-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this {isReturn ? 'return' : 'purchase'}?</h3>
                        <p className="bin-confirm-warning">Its stock movement is removed too; moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default PurchaseOrReturnManager;
