import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const MOVEMENT_LABEL = { dump: 'Dump', consume: 'Consume', return: 'Return', waste: 'Waste' };
const MANUAL_TYPES = ['dump', 'return', 'waste'];

const emptyForm = { materialId: '', movementType: 'dump', quantity: '', date: '', notes: '' };

/* Site Inventory ledger for one project — current stock (computed on the
   fly server-side, never stored), a manual Dump/Return/Waste entry form,
   and the full movement history including the `consume` rows the
   measurement-save automation creates (read-only here). */
const StockMovementsManager = ({ url, projectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [stock, setStock] = useState([]);
    const [movements, setMovements] = useState([]);
    const [loadingStock, setLoadingStock] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const fetchStock = async () => {
        setLoadingStock(true);
        try {
            const res = await axios.get(`${url}/api/finance/stock-movements/current-stock`, { ...authHeader, params: { projectId } });
            if (res.data.success) setStock(res.data.data);
        } catch { toast.error('Error fetching current stock'); }
        finally { setLoadingStock(false); }
    };

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await axios.get(`${url}/api/finance/stock-movements/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setMovements(res.data.data);
        } catch { toast.error('Error fetching stock movements'); }
        finally { setLoadingHistory(false); }
    };

    useEffect(() => { if (projectId) { fetchStock(); fetchHistory(); } }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.materialId) return toast.error('Material is required');
        if (!form.quantity || Number(form.quantity) <= 0) return toast.error('Quantity must be greater than zero');
        if (!form.date) return toast.error('Date is required');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/stock-movements/add`, { ...form, projectId }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                setForm(emptyForm);
                await Promise.all([fetchStock(), fetchHistory()]);
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error recording movement');
        } finally { setSaving(false); }
    };

    const removeMovement = async (item) => {
        try {
            const res = await axios.delete(`${url}/api/finance/stock-movements/remove`, { ...authHeader, data: { _id: item._id } });
            if (res.data.success) { toast.success(res.data.message); await Promise.all([fetchStock(), fetchHistory()]); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing movement'); }
    };

    return (
        <div>
            <h3 style={{ marginBottom: '8px' }}>Current Stock</h3>
            <div className="list-table" style={{ marginBottom: '28px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
                    <b>Material</b><b>Unit</b><b>Current Stock</b>
                </div>
                {loadingStock ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : stock.length === 0 ? (
                    <div className="admin-empty-state"><p>No stock movements recorded yet.</p></div>
                ) : (
                    stock.map(row => (
                        <div key={row.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
                            <p>{row.materialName || '—'}</p>
                            <p>{row.unit || '—'}</p>
                            <p style={{ color: row.currentStock < 0 ? '#c0392b' : undefined }}>{row.currentStock}</p>
                        </div>
                    ))
                )}
            </div>

            <h3 style={{ marginBottom: '8px' }}>Record Dump / Return / Waste</h3>
            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Material *</p>
                        <QuickAddPicker url={url} resourceKey="materials" value={form.materialId} onChange={v => setField('materialId', v)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Movement Type *</p>
                        <select value={form.movementType} onChange={e => setField('movementType', e.target.value)}>
                            {MANUAL_TYPES.map(t => <option key={t} value={t}>{MOVEMENT_LABEL[t]}</option>)}
                        </select>
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Quantity *</p>
                        <input type="number" value={form.quantity} onChange={e => setField('quantity', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Date *</p>
                        <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col wizard-field-full">
                        <p>Notes</p>
                        <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : '+ Add Movement'}</button>
                </div>
            </form>

            <h3 style={{ marginBottom: '8px' }}>Movement History</h3>
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.3fr 1fr 1fr 1fr 100px' }}>
                    <b>Date</b><b>Material</b><b>Type</b><b>Quantity</b><b>Notes</b><b>Action</b>
                </div>
                {loadingHistory ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : movements.length === 0 ? (
                    <div className="admin-empty-state"><p>No movements yet.</p></div>
                ) : (
                    movements.map(m => (
                        <div key={m._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.3fr 1fr 1fr 1fr 100px' }}>
                            <p>{new Date(m.date).toLocaleDateString()}</p>
                            <p>{m.materialId?.name || '—'}</p>
                            <p><span className="item-category">{MOVEMENT_LABEL[m.movementType]}{m.relatedMeasurementId ? ' (auto)' : ''}</span></p>
                            <p>{m.quantity} {m.materialId?.unit || ''}</p>
                            <p>{m.notes || '—'}</p>
                            <div className="action-buttons">
                                {!m.relatedMeasurementId && <p onClick={() => removeMovement(m)} className="cursor delete-action">X</p>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default StockMovementsManager;
