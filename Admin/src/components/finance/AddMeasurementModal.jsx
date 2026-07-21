import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import { useSupervisorConflictCheck } from './useSupervisorConflictCheck';

const emptyState = {
    measurementType: 'contractor',
    projectId: '', workId: '', contractorVendorId: '', labourerId: '',
    date: '', supervisorId: '', areaCoveredSqft: '', remarks: '',
};

/*
 * Log a single day's measurement without leaving the page — used both
 * scoped to one project (a project's own Measurements tab, `projectId`
 * fixed) and unscoped (Site Operations' Daily Measurements, no
 * `projectId` — a Project field is shown first, same dual-mode pattern as
 * WorkMeasurementsSummary). Contractor and Labour measurements are
 * different underlying models (financeMeasurement vs.
 * financeLabourMeasurement) with different fields — the type toggle at
 * the top switches which sub-form and which endpoint is used.
 */
const AddMeasurementModal = ({ url, projectId: fixedProjectId, defaultProjectId, defaultDate, defaultWorkId, onClose, onSaved }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [form, setForm] = useState({
        ...emptyState,
        projectId: fixedProjectId || defaultProjectId || '',
        date: defaultDate || '',
        workId: defaultWorkId || '',
    });
    const [projects, setProjects] = useState([]);
    const [works, setWorks] = useState([]);
    const [workContractors, setWorkContractors] = useState([]);
    const [workLabourers, setWorkLabourers] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [materialTrackingEnabled, setMaterialTrackingEnabled] = useState(false);
    const [materials, setMaterials] = useState([]);
    const [materialLines, setMaterialLines] = useState([]);
    const [saving, setSaving] = useState(false);
    const { checkSupervisor, modal: supervisorConflictModal } = useSupervisorConflictCheck(url);

    useEffect(() => {
        if (fixedProjectId) return;
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url, fixedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        axios.get(`${url}/api/finance/materials/list`, authHeader)
            .then(res => { if (res.data.success) setMaterials(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/employees/list`, authHeader)
            .then(res => { if (res.data.success) setEmployees(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!form.projectId) { setWorks([]); setMaterialTrackingEnabled(false); return; }
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId: form.projectId } })
            .then(res => { if (res.data.success) setWorks(res.data.data); }).catch(() => setWorks([]));
        axios.get(`${url}/api/finance/projects/${form.projectId}`, authHeader)
            .then(res => { if (res.data.success) setMaterialTrackingEnabled(!!res.data.data.project?.materialTrackingEnabled); }).catch(() => {});
    }, [url, form.projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!form.workId) { setWorkContractors([]); setWorkLabourers([]); return; }
        axios.get(`${url}/api/finance/work-contractor-assignments/list`, { ...authHeader, params: { workId: form.workId } })
            .then(res => { if (res.data.success) setWorkContractors(res.data.data); }).catch(() => setWorkContractors([]));
        axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { workId: form.workId } })
            .then(res => { if (res.data.success) setWorkLabourers(res.data.data); }).catch(() => setWorkLabourers([]));
    }, [url, form.workId]); // eslint-disable-line react-hooks/exhaustive-deps

    // A labourer picked here is always already on this Work's roster (the
    // dropdown itself is built from work-labour-assignments), so their
    // supervisor is always known — pre-fill it rather than leaving the
    // field blank. Still editable below (a substitute could've run the
    // crew that day), routed through the conflict check when it's changed
    // away from this default.
    useEffect(() => {
        if (!form.labourerId) return;
        const assignment = workLabourers.find(a => (a.labourerId?._id || a.labourerId) === form.labourerId);
        const supervisorId = assignment?.supervisorId?._id || assignment?.supervisorId || '';
        setForm(prev => (prev.labourerId === form.labourerId ? { ...prev, supervisorId } : prev));
    }, [form.labourerId, workLabourers]); // eslint-disable-line react-hooks/exhaustive-deps

    // Which materials a Work can use isn't a free choice — it's already
    // declared once, per work type, via financeMaterial.workTypes (Masters
    // → Material Master). So this derives a fixed checklist (one quantity
    // box per applicable material) instead of a searchable pick-and-add
    // list; nothing to "add", the set is already known the moment a Work
    // is selected. Untagged materials count as usable everywhere (see the
    // field's own doc comment), same rule the checklist honors here.
    useEffect(() => {
        if (!form.workId) { setMaterialLines([]); return; }
        const workType = works.find(w => w._id === form.workId)?.workType;
        const applicable = materials.filter(m => !m.workTypes?.length || m.workTypes.includes(workType));
        setMaterialLines(applicable.map(m => ({ materialId: m._id, quantity: '' })));
    }, [form.workId, materials, works]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => {
        const next = { ...prev, [key]: value };
        if (key === 'projectId') { next.workId = ''; next.contractorVendorId = ''; next.labourerId = ''; next.supervisorId = ''; }
        if (key === 'workId') { next.contractorVendorId = ''; next.labourerId = ''; next.supervisorId = ''; }
        if (key === 'measurementType') { next.contractorVendorId = ''; next.labourerId = ''; next.supervisorId = ''; }
        return next;
    });

    const employeeOptions = employees.map(e => ({ value: e._id, label: e.name }));
    const pickSupervisor = (candidateId) => {
        checkSupervisor(candidateId, form.workId, () => setField('supervisorId', candidateId));
    };

    const setMaterialLine = (idx, key, value) => setMaterialLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: value } : l));

    const projectOptions = projects.map(p => ({ value: p._id, label: p.name }));
    const workOptions = works.map(w => ({ value: w._id, label: `${w.workType}${w.workOrderNumber ? ` (${w.workOrderNumber})` : ''}` }));
    const contractorOptions = workContractors.map(a => ({ value: a.contractorVendorId?._id || a.contractorVendorId, label: a.contractorVendorId?.name || '-' }));
    const labourerOptions = workLabourers.map(a => ({
        value: a.labourerId?._id || a.labourerId,
        label: `${a.labourerId?.name || '-'}${a.supervisorId?.name ? ` · ${a.supervisorId.name}'s team` : ''}`,
    }));

    const submitContractor = () => axios.post(`${url}/api/finance/measurements/add`, {
        projectId: form.projectId, workId: form.workId, contractorVendorId: form.contractorVendorId,
        date: form.date, areaCoveredSqft: form.areaCoveredSqft,
        remarks: form.remarks, materialUsed: materialLines.filter(l => l.materialId && Number(l.quantity) > 0),
    }, authHeader);

    const submitLabour = () => axios.post(`${url}/api/finance/labour-measurements/add`, {
        projectId: form.projectId, workId: form.workId, labourerId: form.labourerId, supervisorId: form.supervisorId || undefined,
        date: form.date, areaCoveredSqft: form.areaCoveredSqft, remarks: form.remarks,
    }, authHeader);

    const submit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isContractor = form.measurementType === 'contractor';
        if (!form.projectId) return toast.error('Project is required');
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

    return <>{ReactDOM.createPortal(
        <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
            <div className="loader-modal-box edit-modal">
                <h2>Add Measurement</h2>

                <div className="measurement-type-toggle">
                    <button type="button" className={`labour-chip${isContractor ? ' active' : ''}`} onClick={() => setField('measurementType', 'contractor')}>Contractor</button>
                    <button type="button" className={`labour-chip${!isContractor ? ' active' : ''}`} onClick={() => setField('measurementType', 'labour')}>Labour</button>
                </div>

                <form onSubmit={submit}>
                    <div className="wizard-field-grid">
                        {!fixedProjectId && (
                            <div className="add-product-name flex-col wizard-field-full">
                                <p>Project *</p>
                                <StyledSelect value={form.projectId} onChange={v => setField('projectId', v)} placeholder="Select project…" options={projectOptions} />
                            </div>
                        )}
                        <div className="add-product-name flex-col wizard-field-full">
                            <p>Work *</p>
                            <StyledSelect
                                value={form.workId} onChange={v => setField('workId', v)}
                                placeholder={form.projectId ? 'Select work…' : 'Select a project first'}
                                options={workOptions} disabled={!form.projectId}
                            />
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
                        {!isContractor && (
                            <div className="add-product-name flex-col">
                                <p>Supervisor</p>
                                <StyledSelect
                                    value={form.supervisorId} onChange={pickSupervisor}
                                    placeholder={!form.labourerId ? 'Select a labourer first' : 'Select supervisor…'}
                                    options={employeeOptions}
                                    disabled={!form.labourerId}
                                />
                            </div>
                        )}

                        <div className="add-product-name flex-col wizard-field-full">
                            <p>Remarks</p>
                            <textarea rows="2" value={form.remarks} onChange={e => setField('remarks', e.target.value)} />
                        </div>
                    </div>

                    {isContractor && materialTrackingEnabled && (
                        <div style={{ margin: '4px 0 20px' }}>
                            <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                                Material Used {materialLines.length > 0 && `(for ${form.areaCoveredSqft || '?'} sqft covered above, not per material)`}
                            </p>
                            {!form.workId ? (
                                <p className="admin-subtitle">Select a work first.</p>
                            ) : materialLines.length === 0 ? (
                                <p className="admin-subtitle">
                                    No materials are tagged to this work type yet; add them from Masters → Material Master.
                                </p>
                            ) : materialLines.map((line, idx) => {
                                const material = materials.find(m => m._id === line.materialId);
                                return (
                                    <div key={line.materialId} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
                                        <p style={{ flex: 2, margin: 0 }}>{material?.name || '-'}</p>
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <input type="number" placeholder="Quantity" value={line.quantity} onChange={e => setMaterialLine(idx, 'quantity', e.target.value)} style={{ width: '100%' }} />
                                            {material?.unit && <span className="admin-subtitle" style={{ whiteSpace: 'nowrap' }}>{material.unit}</span>}
                                        </div>
                                    </div>
                                );
                            })}
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
    )}{supervisorConflictModal}</>;
};

export default AddMeasurementModal;
