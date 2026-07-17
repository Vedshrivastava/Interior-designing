import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';

const emptyState = {
    measurementType: 'contractor',
    workId: '', contractorVendorId: '', labourerId: '',
    date: '', supervisorName: '', areaCoveredSqft: '', remarks: '',
};

/*
 * Log a single day's measurement against a Work, from the project's
 * Measurements tab, without leaving the page. Contractor and Labour
 * measurements are different underlying models (financeMeasurement vs.
 * financeLabourMeasurement) with different fields — the type toggle at
 * the top switches which sub-form and which endpoint is used, everything
 * else mirrors Site Operations' / Labour Measurements' own entry forms
 * exactly so the two stay in lockstep.
 */
const AddMeasurementModal = ({ url, projectId, works, onClose, onSaved }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [form, setForm] = useState(emptyState);
    const [workContractors, setWorkContractors] = useState([]);
    const [workLabourers, setWorkLabourers] = useState([]);
    const [materialTrackingEnabled, setMaterialTrackingEnabled] = useState(false);
    const [materials, setMaterials] = useState([]);
    const [materialLines, setMaterialLines] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/${projectId}`, authHeader)
            .then(res => { if (res.data.success) setMaterialTrackingEnabled(!!res.data.data.project?.materialTrackingEnabled); }).catch(() => {});
        axios.get(`${url}/api/finance/materials/list`, authHeader)
            .then(res => { if (res.data.success) setMaterials(res.data.data); }).catch(() => {});
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!form.workId) { setWorkContractors([]); setWorkLabourers([]); return; }
        axios.get(`${url}/api/finance/work-contractor-assignments/list`, { ...authHeader, params: { workId: form.workId } })
            .then(res => { if (res.data.success) setWorkContractors(res.data.data); }).catch(() => setWorkContractors([]));
        axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { workId: form.workId } })
            .then(res => { if (res.data.success) setWorkLabourers(res.data.data); }).catch(() => setWorkLabourers([]));
    }, [url, form.workId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => {
        const next = { ...prev, [key]: value };
        if (key === 'workId') { next.contractorVendorId = ''; next.labourerId = ''; }
        if (key === 'measurementType') { next.contractorVendorId = ''; next.labourerId = ''; }
        return next;
    });

    const addMaterialLine = () => setMaterialLines(prev => [...prev, { materialId: '', quantity: '' }]);
    const setMaterialLine = (idx, key, value) => setMaterialLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: value } : l));
    const removeMaterialLine = (idx) => setMaterialLines(prev => prev.filter((_, i) => i !== idx));

    const workOptions = works.map(w => ({ value: w._id, label: `${w.workType}${w.workOrderNumber ? ` (${w.workOrderNumber})` : ''}` }));
    const contractorOptions = workContractors.map(a => ({ value: a.contractorVendorId?._id || a.contractorVendorId, label: a.contractorVendorId?.name || '—' }));
    const labourerOptions = workLabourers.map(a => ({
        value: a.labourerId?._id || a.labourerId,
        label: `${a.labourerId?.name || '—'}${a.supervisorId?.name ? ` — ${a.supervisorId.name}'s team` : ''}`,
    }));

    const submitContractor = async () => {
        const data = new FormData();
        data.append('projectId', projectId);
        data.append('workId', form.workId);
        data.append('contractorVendorId', form.contractorVendorId);
        data.append('date', form.date);
        data.append('supervisorName', form.supervisorName);
        data.append('areaCoveredSqft', form.areaCoveredSqft);
        data.append('remarks', form.remarks);
        data.append('materialUsed', JSON.stringify(materialLines.filter(l => l.materialId && Number(l.quantity) > 0)));
        photos.forEach(f => data.append('photos', f));
        return axios.post(`${url}/api/finance/measurements/add`, data, {
            headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
        });
    };

    const submitLabour = () => axios.post(`${url}/api/finance/labour-measurements/add`, {
        projectId, workId: form.workId, labourerId: form.labourerId,
        date: form.date, areaCoveredSqft: form.areaCoveredSqft, remarks: form.remarks,
    }, authHeader);

    const submit = async (e) => {
        e.preventDefault();
        const isContractor = form.measurementType === 'contractor';
        if (!form.workId) return toast.error('Work is required');
        if (isContractor && !form.contractorVendorId) return toast.error('Contractor is required');
        if (!isContractor && !form.labourerId) return toast.error('Labourer is required');
        if (!form.date) return toast.error('Date is required');
        if (!form.areaCoveredSqft || Number(form.areaCoveredSqft) <= 0) return toast.error('Area covered must be greater than zero');

        setSaving(true);
        try {
            const res = await (isContractor ? submitContractor() : submitLabour());
            if (res.data.success) {
                toast.success(res.data.message || 'Measurement saved');
                onSaved?.();
                onClose();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving measurement');
        } finally { setSaving(false); }
    };

    const isContractor = form.measurementType === 'contractor';

    return ReactDOM.createPortal(
        <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
            <div className="loader-modal-box edit-modal">
                <h2>Add Measurement</h2>

                <div className="measurement-type-toggle">
                    <button type="button" className={`labour-chip${isContractor ? ' active' : ''}`} onClick={() => setField('measurementType', 'contractor')}>Contractor</button>
                    <button type="button" className={`labour-chip${!isContractor ? ' active' : ''}`} onClick={() => setField('measurementType', 'labour')}>Labour</button>
                </div>

                <form onSubmit={submit}>
                    <div className="wizard-field-grid">
                        <div className="add-product-name flex-col wizard-field-full">
                            <p>Work *</p>
                            <StyledSelect value={form.workId} onChange={v => setField('workId', v)} placeholder="Select work…" options={workOptions} />
                        </div>

                        {isContractor ? (
                            <div className="add-product-name flex-col">
                                <p>Contractor *</p>
                                <StyledSelect
                                    value={form.contractorVendorId} onChange={v => setField('contractorVendorId', v)}
                                    placeholder={
                                        !form.workId ? 'Select a work first'
                                            : contractorOptions.length === 0 ? 'No contractor assigned for this work'
                                                : 'Select contractor…'
                                    }
                                    options={contractorOptions}
                                    disabled={!form.workId || contractorOptions.length === 0}
                                />
                            </div>
                        ) : (
                            <div className="add-product-name flex-col">
                                <p>Labourer *</p>
                                <StyledSelect
                                    value={form.labourerId} onChange={v => setField('labourerId', v)}
                                    placeholder={
                                        !form.workId ? 'Select a work first'
                                            : labourerOptions.length === 0 ? 'No labour assigned for this work'
                                                : 'Select labourer…'
                                    }
                                    options={labourerOptions}
                                    disabled={!form.workId || labourerOptions.length === 0}
                                />
                            </div>
                        )}
                        <div className="add-product-name flex-col">
                            <p>Date *</p>
                            <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                        </div>

                        <div className="add-product-name flex-col">
                            <p>Area Covered (sqft) *</p>
                            <input type="number" value={form.areaCoveredSqft} onChange={e => setField('areaCoveredSqft', e.target.value)} />
                        </div>
                        {isContractor && (
                            <div className="add-product-name flex-col">
                                <p>Supervisor</p>
                                <input type="text" value={form.supervisorName} onChange={e => setField('supervisorName', e.target.value)} />
                            </div>
                        )}

                        {isContractor && (
                            <div className="add-product-name flex-col wizard-field-full">
                                <p>Photos</p>
                                <input type="file" multiple accept="image/*" onChange={e => setPhotos(Array.from(e.target.files))} />
                            </div>
                        )}
                        <div className="add-product-name flex-col wizard-field-full">
                            <p>Remarks</p>
                            <textarea rows="2" value={form.remarks} onChange={e => setField('remarks', e.target.value)} />
                        </div>
                    </div>

                    {isContractor && materialTrackingEnabled && (
                        <div style={{ margin: '4px 0 20px' }}>
                            <p className="admin-subtitle" style={{ marginBottom: '8px' }}>Material Used</p>
                            {materialLines.map((line, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                                    <select value={line.materialId} onChange={e => setMaterialLine(idx, 'materialId', e.target.value)} style={{ flex: 2 }}>
                                        <option value="">Select material…</option>
                                        {materials.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                                    </select>
                                    <input type="number" placeholder="Quantity" value={line.quantity} onChange={e => setMaterialLine(idx, 'quantity', e.target.value)} style={{ flex: 1 }} />
                                    <button type="button" className="remove-point-btn" onClick={() => removeMaterialLine(idx)}>X</button>
                                </div>
                            ))}
                            <button type="button" className="add-point-btn" onClick={addMaterialLine}>+ Add Material</button>
                        </div>
                    )}

                    <div className="edit-modal-actions">
                        <button type="button" className="add-btn cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save Measurement'}</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default AddMeasurementModal;
