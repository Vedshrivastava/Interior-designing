import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';

const MOVEMENT_LABEL = { dump: 'Dump', return: 'Return', waste: 'Waste' };
const MANUAL_TYPES = ['dump', 'return', 'waste'];
const MOVEMENT_TYPE_OPTIONS = MANUAL_TYPES.map(t => ({ value: t, label: MOVEMENT_LABEL[t] }));

const emptyForm = { materialId: '', movementType: 'dump', quantity: '', date: '', notes: '' };

/*
 * Record a Dump/Return/Waste stock movement without leaving the Materials
 * tab — same "+ Add" button → dialog pattern as Add Measurement. `consume`
 * movements aren't offered here; they're only ever created automatically
 * by the measurement-save automation, never entered manually.
 */
const AddStockMovementModal = ({ url, projectId, onClose, onSaved }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

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
                toast.success(res.data.message || 'Movement recorded');
                onSaved?.();
                onClose();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error recording movement');
        } finally { setSaving(false); }
    };

    return ReactDOM.createPortal(
        <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
            <div className="loader-modal-box edit-modal">
                <h2>Add Movement</h2>
                <form onSubmit={submit}>
                    <div className="wizard-field-grid">
                        <div className="add-product-name flex-col wizard-field-full">
                            <p>Material *</p>
                            <QuickAddPicker url={url} resourceKey="materials" value={form.materialId} onChange={v => setField('materialId', v)} />
                        </div>
                        <div className="add-product-name flex-col">
                            <p>Movement Type *</p>
                            <StyledSelect value={form.movementType} onChange={v => setField('movementType', v)} options={MOVEMENT_TYPE_OPTIONS} />
                        </div>
                        <div className="add-product-name flex-col">
                            <p>Quantity *</p>
                            <input type="number" value={form.quantity} onChange={e => setField('quantity', e.target.value)} />
                        </div>
                        <div className="add-product-name flex-col wizard-field-full">
                            <p>Date *</p>
                            <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                        </div>
                        <div className="add-product-name flex-col wizard-field-full">
                            <p>Notes</p>
                            <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                        </div>
                    </div>
                    <div className="edit-modal-actions">
                        <button type="button" className="add-btn cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save Movement'}</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default AddStockMovementModal;
