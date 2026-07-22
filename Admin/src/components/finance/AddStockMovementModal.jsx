import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';

const emptyForm = { materialId: '', quantity: '', date: '', notes: '', workId: '' };

/*
 * Record Waste (spoilage/loss of material already paid for) without
 * leaving the Materials tab — same "+ Add" button → dialog pattern as Add
 * Measurement. This is the ONLY manually-enterable movement type:
 * - `consume` is only ever created by the measurement-save automation.
 * - Dump and Return always mean material moving to/from a specific vendor
 *   at some cost, so they're recorded entirely through Procurement's
 *   Purchase/Returns tabs instead (financePurchase.js), which capture the
 *   rate and vendor payable and auto-create the matching stock movement
 *   themselves. A vendor-attached, costless manual Dump/Return used to
 *   live here too — removed because it let material get recorded as
 *   received from a vendor without ever billing that vendor for it.
 * Waste has no vendor (nothing to attribute a spoilage/loss to) and is
 * quantity-only, optionally tied to one Work.
 */
const AddStockMovementModal = ({ url, projectId, onClose, onSaved }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [form, setForm] = useState(emptyForm);
    const [works, setWorks] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [saving, setSaving] = useState(false);

    const fetchWorks = () => {
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId } })
            .then(res => { if (res.data.success) setWorks(res.data.data); }).catch(() => {});
    };
    useEffect(fetchWorks, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeWorksChanged'], fetchWorks);

    // Fetched here (not just left inside the Material QuickAddPicker) so
    // Quantity can show the selected material's own unit next to it —
    // same reason AddMeasurementModal's material lines do the same.
    const fetchMaterials = () => {
        axios.get(`${url}/api/finance/materials/list`, authHeader)
            .then(res => { if (res.data.success) setMaterials(res.data.data); }).catch(() => {});
    };
    useEffect(fetchMaterials, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeMaterialsChanged'], fetchMaterials);

    const selectedMaterial = materials.find(m => m._id === form.materialId);

    const setField = (key, value) => setForm(prev => {
        const next = { ...prev, [key]: value };
        if (key === 'workId') next.materialId = '';
        return next;
    });

    const selectedWorkType = works.find(w => w._id === form.workId)?.workType;
    const materialFilter = form.workId
        ? (m => !m.workTypes?.length || m.workTypes.includes(selectedWorkType))
        : undefined;

    const submit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!form.materialId) return toast.error('Material is required');
        if (!form.quantity || Number(form.quantity) <= 0) return toast.error('Quantity must be greater than zero');
        if (!form.date) return toast.error('Date is required');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/stock-movements/add`, { ...form, movementType: 'waste', projectId }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Waste recorded');
                onSaved?.();
                onClose();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error recording waste');
        } finally { setSaving(false); }
    };

    return ReactDOM.createPortal(
        <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
            <div className="loader-modal-box edit-modal">
                <h2>Record Waste</h2>
                <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                    Spoilage or loss of material already accounted for elsewhere — receiving material from a vendor is recorded as a Purchase in Procurement instead, which handles cost and vendor payment.
                </p>
                <form onSubmit={submit}>
                    <div className="wizard-field-grid">
                        <div className="add-product-name flex-col">
                            <p>Work (optional)</p>
                            <StyledSelect
                                value={form.workId} onChange={v => setField('workId', v)}
                                placeholder="Not tied to one Work…"
                                options={works.map(w => ({ value: w._id, label: `${w.workType}${w.workOrderNumber ? ` (${w.workOrderNumber})` : ''}` }))}
                            />
                        </div>
                        <div className="add-product-name flex-col">
                            <p>Material *</p>
                            <QuickAddPicker url={url} resourceKey="materials" value={form.materialId} onChange={v => setField('materialId', v)} filter={materialFilter} />
                        </div>
                        <div className="add-product-name flex-col">
                            <p>Quantity *</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.quantity} onChange={e => setField('quantity', e.target.value)} style={{ flex: 1 }} />
                                {selectedMaterial?.unit && <span className="admin-subtitle" style={{ whiteSpace: 'nowrap' }}>{selectedMaterial.unit}</span>}
                            </div>
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
                        <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default AddStockMovementModal;
