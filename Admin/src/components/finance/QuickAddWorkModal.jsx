import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import ContractorOrLabourPicker from './ContractorOrLabourPicker';
import StyledSelect from './StyledSelect';

const emptyAssignmentRow = () => ({ contractorVendorId: '', notes: '' });

/*
 * "Add a Work" without leaving Work Type Rates / Contractor Rates — used
 * only when a project has zero real Works yet, so those rate managers
 * would otherwise be forced to list every Masters work type as if it were
 * already something real to bill against (see WorkTypeRatesManager.jsx /
 * ContractorRatesManager.jsx's realWorkTypes === null fallback).
 *
 * Deliberately skips workOrderNumber/startDate/notes — the two fields
 * financeWork actually requires server-side are workType and
 * estimatedAreaSqft, plus at least one contractor. The Work this creates
 * is flagged quickAdded so it shows a "Details Missing" badge in
 * WorksManager until someone opens it there and saves through the full
 * Edit Work form.
 */
const QuickAddWorkModal = ({ url, projectId, initialWorkType, onClose, onCreated }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    const [workType, setWorkType] = useState(initialWorkType || '');
    const [estimatedAreaSqft, setEstimatedAreaSqft] = useState('');
    const [assignments, setAssignments] = useState([emptyAssignmentRow()]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'work_type' } })
            .then(res => { if (res.data.success) setWorkTypeOptions(res.data.data.map(s => s.name)); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setAssignmentField = (idx, key, value) =>
        setAssignments(prev => prev.map((a, i) => (i === idx ? { ...a, [key]: value } : a)));
    const addAssignmentRow = () => setAssignments(prev => [...prev, emptyAssignmentRow()]);
    const removeAssignmentRow = (idx) => setAssignments(prev => prev.filter((_, i) => i !== idx));

    const submit = async (e) => {
        e.preventDefault();
        if (!workType.trim()) return toast.error('Work type is required');
        if (!estimatedAreaSqft || Number(estimatedAreaSqft) <= 0) return toast.error('Estimated area is required');
        const filledAssignments = assignments.filter(a => a.contractorVendorId);
        if (!filledAssignments.length) return toast.error('At least one contractor is required');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/works/add`, {
                projectId, workType: workType.trim(), estimatedAreaSqft, contractorAssignments: filledAssignments, quickAdded: true,
            }, authHeader);
            if (res.data.success) {
                toast.success('Work added; fill in the rest later from the Works tab');
                onCreated(res.data.data);
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding work');
        } finally { setSaving(false); }
    };

    return ReactDOM.createPortal(
        <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
            <div className="loader-modal-box edit-modal">
                <h2>Add Work</h2>
                <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                    No Works exist for this project yet, so there's nothing real to set a rate against. Add the minimum here:
                    work order number, start date, and notes can be filled in later from the Works tab.
                </p>
                <form className="flex-col" onSubmit={submit}>
                    <div className="add-product-name flex-col">
                        <p>Work Type *</p>
                        <StyledSelect
                            value={workType} onChange={setWorkType}
                            placeholder="Select work type…"
                            options={workTypeOptions.map(w => ({ value: w, label: w }))}
                        />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Estimated Area (sqft) *</p>
                        <input type="number" value={estimatedAreaSqft} onChange={e => setEstimatedAreaSqft(e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Contractor(s) *</p>
                        <div className="add-product-points">
                            {assignments.map((a, idx) => (
                                <div key={idx} className="point-input">
                                    <div style={{ flex: 1 }}>
                                        <ContractorOrLabourPicker url={url} value={a.contractorVendorId}
                                            onChange={v => setAssignmentField(idx, 'contractorVendorId', v)} />
                                    </div>
                                    <input type="text" placeholder="Notes (optional)" value={a.notes}
                                        onChange={e => setAssignmentField(idx, 'notes', e.target.value)} style={{ flex: 1 }} />
                                    {assignments.length > 1 && (
                                        <button type="button" className="remove-point-btn" onClick={() => removeAssignmentRow(idx)}>X</button>
                                    )}
                                </div>
                            ))}
                            <button type="button" className="add-point-btn" onClick={addAssignmentRow}>+ Add Contractor</button>
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

export default QuickAddWorkModal;
