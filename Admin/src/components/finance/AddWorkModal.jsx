import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import ContractorOrLabourPicker from './ContractorOrLabourPicker';
import LabourMultiSelect from './LabourMultiSelect';
import QuickAddPicker from './QuickAddPicker';
import StyledSelect from './StyledSelect';
import { useSupervisorConflictCheck } from './useSupervisorConflictCheck';

const emptyForm = { workType: '', workOrderNumber: '', startDate: '', estimatedAreaSqft: '', status: 'active', notes: '' };
const emptyAssignmentRow = () => ({ contractorVendorId: '', notes: '' });

/* The one "Add Work" / "Edit Work" dialog, extracted out of WorksManager so
   it can be triggered from anywhere a Work needs creating — WorksManager's
   own "+ Add Work" button and row-level Edit action, and
   WorkTypeRatesManager's "+ Add Work" nudge (shown when this project has
   no real Work yet to rate against). That second trigger used to open a
   separate, lighter QuickAddWorkModal (Work Type / Estimated Area /
   Contractor(s) only, no labour team) — now it's the exact same dialog
   regardless of where it's opened from. */
const AddWorkModal = ({ url, projectId, editingWork, onClose, onSaved }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const editingId = editingWork?._id || null;

    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    const [form, setForm] = useState(() => editingWork ? {
        workType: editingWork.workType,
        workOrderNumber: editingWork.workOrderNumber || '',
        startDate: editingWork.startDate ? new Date(editingWork.startDate).toISOString().slice(0, 10) : '',
        estimatedAreaSqft: editingWork.estimatedAreaSqft, status: editingWork.status, notes: editingWork.notes || '',
    } : emptyForm);
    const [contractorAssignments, setContractorAssignments] = useState([emptyAssignmentRow()]);
    const [labourSupervisorId, setLabourSupervisorId] = useState('');
    const [selectedLabourerIds, setSelectedLabourerIds] = useState([]);
    const [saving, setSaving] = useState(false);
    const { checkSupervisor, modal: supervisorConflictModal } = useSupervisorConflictCheck(url);

    useEffect(() => {
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'work_type' } })
            .then(res => { if (res.data.success) setWorkTypeOptions(res.data.data.map(s => s.name)); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const setAssignmentField = (idx, key, value) =>
        setContractorAssignments(prev => prev.map((a, i) => (i === idx ? { ...a, [key]: value } : a)));
    const addAssignmentRow = () => setContractorAssignments(prev => [...prev, emptyAssignmentRow()]);
    const removeAssignmentRow = (idx) => setContractorAssignments(prev => prev.filter((_, i) => i !== idx));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.workType.trim()) return toast.error('Work type is required');
        if (!form.estimatedAreaSqft || Number(form.estimatedAreaSqft) <= 0) return toast.error('Estimated area is required');
        if (!editingId) {
            if (!contractorAssignments.some(a => a.contractorVendorId) && !selectedLabourerIds.length) {
                return toast.error('At least one contractor or labourer is required');
            }
            if (selectedLabourerIds.length && !labourSupervisorId) {
                return toast.error('Supervisor is required for the labour team');
            }
        }
        setSaving(true);
        try {
            const payload = editingId
                ? { ...form, _id: editingId, projectId }
                : {
                    ...form, projectId,
                    contractorAssignments: contractorAssignments.filter(a => a.contractorVendorId),
                    labourSupervisorId: selectedLabourerIds.length ? labourSupervisorId : undefined,
                    labourerIds: selectedLabourerIds,
                };
            const endpoint = editingId ? 'update' : 'add';
            const res = await axios.post(`${url}/api/finance/works/${endpoint}`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Work saved');
                onSaved(res.data.data);
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving work');
        } finally { setSaving(false); }
    };

    return (
        <>
            {ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>{editingId ? 'Edit Work' : 'Add Work'}</h2>
                        <form className="flex-col" onSubmit={submit}>
                            <div className="add-product-name flex-col">
                                <p>Work Type *</p>
                                <StyledSelect
                                    value={form.workType} onChange={v => setField('workType', v)}
                                    placeholder="Select work type…"
                                    options={workTypeOptions.map(w => ({ value: w, label: w }))}
                                />
                            </div>

                            {!editingId && (
                                <div className="add-product-name flex-col">
                                    <p>Contractor(s)</p>
                                    <div className="contractor-assign-box">
                                        {contractorAssignments.map((a, idx) => (
                                            <div key={idx} className="contractor-assign-row">
                                                <div className="contractor-assign-picker">
                                                    <ContractorOrLabourPicker url={url} value={a.contractorVendorId}
                                                        onChange={v => setAssignmentField(idx, 'contractorVendorId', v)} />
                                                </div>
                                                <div className="contractor-assign-notes">
                                                    <input type="text" placeholder="Notes (optional)" value={a.notes}
                                                        onChange={e => setAssignmentField(idx, 'notes', e.target.value)} />
                                                </div>
                                                {contractorAssignments.length > 1 && (
                                                    <button type="button" className="contractor-assign-remove" aria-label="Remove contractor row"
                                                        onClick={() => removeAssignmentRow(idx)}>×</button>
                                                )}
                                            </div>
                                        ))}
                                        <div className="contractor-assign-footer">
                                            <button type="button" className="add-point-btn" onClick={addAssignmentRow}>+ Add Contractor</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!editingId && (
                                <div className="add-product-name flex-col">
                                    <p>Labour Team{selectedLabourerIds.length > 0 ? ' *' : ''}</p>
                                    <p className="admin-subtitle" style={{ margin: '0 0 8px' }}>Pick a supervisor and the labourers they're bringing to this work; optional, only if you're assigning labour now.</p>
                                    <div style={{ marginBottom: '8px' }}>
                                        <QuickAddPicker
                                            url={url} resourceKey="employees" value={labourSupervisorId}
                                            onChange={id => checkSupervisor(id, null, () => setLabourSupervisorId(id))}
                                            placeholder="Select supervisor for this team…"
                                        />
                                    </div>
                                    <LabourMultiSelect url={url} selectedIds={selectedLabourerIds} onChange={setSelectedLabourerIds} />
                                    <p className="admin-subtitle" style={{ marginTop: '6px' }}>At least one contractor or labourer is required.</p>
                                </div>
                            )}

                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Work Order Number</p>
                                    <input type="text" value={form.workOrderNumber} onChange={e => setField('workOrderNumber', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Start Date</p>
                                    <input type="date" value={form.startDate} onChange={e => setField('startDate', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Estimated Area (sqft) *</p>
                                    <input type="number" value={form.estimatedAreaSqft} onChange={e => setField('estimatedAreaSqft', e.target.value)} />
                                </div>
                                {editingId && (
                                    <div className="add-product-name flex-col">
                                        <p>Status</p>
                                        <select value={form.status} onChange={e => setField('status', e.target.value)}>
                                            <option value="active">Active</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </div>
                                )}
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Notes</p>
                                    <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
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
            )}
            {supervisorConflictModal}
        </>
    );
};

export default AddWorkModal;
