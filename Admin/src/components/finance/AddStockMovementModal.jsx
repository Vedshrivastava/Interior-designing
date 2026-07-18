import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';

const MOVEMENT_LABEL = { dump: 'Dump', return: 'Return', waste: 'Waste' };
const MANUAL_TYPES = ['dump', 'return', 'waste'];
const MOVEMENT_TYPE_OPTIONS = MANUAL_TYPES.map(t => ({ value: t, label: MOVEMENT_LABEL[t] }));

const emptyForm = { materialId: '', movementType: 'dump', quantity: '', date: '', notes: '', workId: '' };

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
    const [works, setWorks] = useState([]);
    const [saving, setSaving] = useState(false);

    // Only waste is attributable to one specific Work (dump/return stay
    // project-level, per the model) — this is what makes the material
    // picker filterable by work type below.
    useEffect(() => {
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId } })
            .then(res => { if (res.data.success) setWorks(res.data.data); }).catch(() => {});
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => {
        const next = { ...prev, [key]: value };
        if (key === 'movementType' && value !== 'waste') { next.workId = ''; next.materialId = ''; }
        if (key === 'workId') next.materialId = '';
        return next;
    });

    const selectedWorkType = works.find(w => w._id === form.workId)?.workType;
    const materialFilter = form.movementType === 'waste' && form.workId
        ? (m => !m.workTypes?.length || m.workTypes.includes(selectedWorkType))
        : undefined;

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
                        <div className="add-product-name flex-col">
                            <p>Movement Type *</p>
                            <StyledSelect value={form.movementType} onChange={v => setField('movementType', v)} options={MOVEMENT_TYPE_OPTIONS} />
                        </div>
                        {form.movementType === 'waste' && (
                            <div className="add-product-name flex-col">
                                <p>Work (optional)</p>
                                <StyledSelect
                                    value={form.workId} onChange={v => setField('workId', v)}
                                    placeholder="Not tied to one Work…"
                                    options={works.map(w => ({ value: w._id, label: `${w.workType}${w.workOrderNumber ? ` (${w.workOrderNumber})` : ''}` }))}
                                />
                            </div>
                        )}
                        <div className="add-product-name flex-col wizard-field-full">
                            <p>Material *</p>
                            <QuickAddPicker url={url} resourceKey="materials" value={form.materialId} onChange={v => setField('materialId', v)} filter={materialFilter} />
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
