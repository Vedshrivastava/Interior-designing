import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import ContractorOrLabourPicker from './ContractorOrLabourPicker';
import StyledSelect from './StyledSelect';
import '../../styles/list.css';
import '../../styles/add.css';

const STATUS_LABEL = { active: 'Active', completed: 'Completed' };

const emptyForm = { workType: '', workOrderNumber: '', startDate: '', estimatedAreaSqft: '', status: 'active', notes: '' };
const emptyAssignmentRow = () => ({ contractorVendorId: '', notes: '' });

/* Manages financeWork rows for one project — the individual work items
   (e.g. "Putty" done by one or more contractors) that measurements get
   logged against. completedAreaSqft is read-only here; it's only ever
   moved by the measurement-save automation on the backend.

   A Work can have more than one contractor (splitting the same scope), so
   assignment isn't a single field on the Work anymore:
     - Creating a Work takes one or more contractors up front (contractorAssignments).
     - Changing an existing Work's contractors happens in a separate
       "Manage Contractors" modal, calling /work-contractor-assignments
       directly — the Work's own edit form no longer touches that data. */
const WorksManager = ({ url, projectId, onWorksChanged }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [works, setWorks] = useState([]);
    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [contractorAssignments, setContractorAssignments] = useState([emptyAssignmentRow()]);
    const [saving, setSaving] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const [contractorsModalWork, setContractorsModalWork] = useState(null);
    const [workContractors, setWorkContractors] = useState([]);
    const [newContractorVendorId, setNewContractorVendorId] = useState('');
    const [newContractorNotes, setNewContractorNotes] = useState('');
    const [contractorsLoading, setContractorsLoading] = useState(false);
    const [contractorsSaving, setContractorsSaving] = useState(false);

    const fetchWorks = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setWorks(res.data.data);
        } catch { toast.error('Error fetching works'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (projectId) fetchWorks(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'work_type' } })
            .then(res => { if (res.data.success) setWorkTypeOptions(res.data.data.map(s => s.name)); }).catch(() => {});
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const openAdd = () => { setEditingId(null); setForm(emptyForm); setContractorAssignments([emptyAssignmentRow()]); setModalOpen(true); };
    const openEdit = (w) => {
        setEditingId(w._id);
        setForm({
            workType: w.workType,
            workOrderNumber: w.workOrderNumber || '', startDate: w.startDate ? new Date(w.startDate).toISOString().slice(0, 10) : '',
            estimatedAreaSqft: w.estimatedAreaSqft, status: w.status, notes: w.notes || '',
        });
        setModalOpen(true);
    };
    const closeModal = () => { setModalOpen(false); setEditingId(null); };
    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const setAssignmentField = (idx, key, value) =>
        setContractorAssignments(prev => prev.map((a, i) => (i === idx ? { ...a, [key]: value } : a)));
    const addAssignmentRow = () => setContractorAssignments(prev => [...prev, emptyAssignmentRow()]);
    const removeAssignmentRow = (idx) => setContractorAssignments(prev => prev.filter((_, i) => i !== idx));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.workType.trim()) return toast.error('Work type is required');
        if (!form.estimatedAreaSqft || Number(form.estimatedAreaSqft) <= 0) return toast.error('Estimated area is required');
        if (!editingId && !contractorAssignments.some(a => a.contractorVendorId)) return toast.error('At least one contractor is required');

        setSaving(true);
        try {
            const payload = editingId
                ? { ...form, _id: editingId, projectId }
                : { ...form, projectId, contractorAssignments: contractorAssignments.filter(a => a.contractorVendorId) };
            const endpoint = editingId ? 'update' : 'add';
            const res = await axios.post(`${url}/api/finance/works/${endpoint}`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Work saved');
                closeModal();
                await fetchWorks();
                onWorksChanged?.();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving work');
        } finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.post(`${url}/api/finance/works/remove`, { _id: confirmItem._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchWorks(); onWorksChanged?.(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing work'); }
        finally { setDeleting(false); }
    };

    const openContractorsModal = async (w) => {
        setContractorsModalWork(w);
        setNewContractorVendorId(''); setNewContractorNotes('');
        await fetchWorkContractors(w._id);
    };
    const closeContractorsModal = () => setContractorsModalWork(null);

    const fetchWorkContractors = async (workId) => {
        setContractorsLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/work-contractor-assignments/list`, { ...authHeader, params: { workId } });
            if (res.data.success) setWorkContractors(res.data.data);
        } catch { toast.error('Error fetching contractor assignments'); }
        finally { setContractorsLoading(false); }
    };

    const addWorkContractor = async () => {
        if (!newContractorVendorId) return toast.error('Select a contractor');
        setContractorsSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/work-contractor-assignments/add`,
                { workId: contractorsModalWork._id, contractorVendorId: newContractorVendorId, notes: newContractorNotes }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                setNewContractorVendorId(''); setNewContractorNotes('');
                await fetchWorkContractors(contractorsModalWork._id);
                await fetchWorks();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error assigning contractor');
        } finally { setContractorsSaving(false); }
    };

    const removeWorkContractor = async (assignmentId) => {
        try {
            const res = await axios.post(`${url}/api/finance/work-contractor-assignments/remove`, { _id: assignmentId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchWorkContractors(contractorsModalWork._id); await fetchWorks(); }
            else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error removing contractor');
        }
    };

    const totalEstimated = works.reduce((sum, w) => sum + (w.estimatedAreaSqft || 0), 0);
    const totalCompleted = works.reduce((sum, w) => sum + (w.completedAreaSqft || 0), 0);

    return (
        <div>
            {works.length > 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                    Progress across all works: {totalCompleted.toLocaleString('en-IN')} / {totalEstimated.toLocaleString('en-IN')} sqft
                    {totalEstimated > 0 && ` (${Math.round((totalCompleted / totalEstimated) * 100)}%)`}
                </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button type="button" className="add-point-btn" onClick={openAdd}>+ Add Work</button>
            </div>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1.6fr 1fr 260px' }}>
                    <b>Work Type</b><b>Completed / Estimated</b><b>Status</b><b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : works.length === 0 ? (
                    <div className="admin-empty-state"><p>No works yet for this project.</p></div>
                ) : (
                    works.map(w => {
                        const pct = w.estimatedAreaSqft > 0 ? Math.min(100, Math.round((w.completedAreaSqft / w.estimatedAreaSqft) * 100)) : 0;
                        return (
                            <div key={w._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1.6fr 1fr 260px' }}>
                                <p>
                                    {w.workType}
                                    {w.quickAdded && (
                                        <span
                                            className="item-category"
                                            style={{ marginLeft: '8px', background: 'rgba(192,57,43,0.12)', color: '#c0392b', borderColor: 'rgba(192,57,43,0.3)' }}
                                            title="Added from Work Type Rates / Contractor Rates before full details were entered — open Edit and save to clear this."
                                        >
                                            ⚠ Details Missing
                                        </span>
                                    )}
                                </p>
                                <p>{w.completedAreaSqft} / {w.estimatedAreaSqft} sqft ({pct}%)</p>
                                <p><span className="item-category">{STATUS_LABEL[w.status]}</span></p>
                                <div className="action-buttons">
                                    <p onClick={() => navigate(`/finance/projects/${projectId}/works/${w._id}`)} className="cursor edit-action">Details</p>
                                    <p onClick={() => openContractorsModal(w)} className="cursor edit-action">Contractors</p>
                                    <p onClick={() => openEdit(w)} className="cursor edit-action">Edit</p>
                                    <p onClick={() => setConfirmItem(w)} className="cursor delete-action">X</p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {modalOpen && ReactDOM.createPortal(
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
                                    <p>Contractor(s) *</p>
                                    <div className="add-product-points">
                                        {contractorAssignments.map((a, idx) => (
                                            <div key={idx} className="point-input">
                                                <div style={{ flex: 1 }}>
                                                    <ContractorOrLabourPicker url={url} value={a.contractorVendorId}
                                                        onChange={v => setAssignmentField(idx, 'contractorVendorId', v)} />
                                                </div>
                                                <input type="text" placeholder="Notes (optional)" value={a.notes}
                                                    onChange={e => setAssignmentField(idx, 'notes', e.target.value)} style={{ flex: 1 }} />
                                                {contractorAssignments.length > 1 && (
                                                    <button type="button" className="remove-point-btn" onClick={() => removeAssignmentRow(idx)}>X</button>
                                                )}
                                            </div>
                                        ))}
                                        <button type="button" className="add-point-btn" onClick={addAssignmentRow}>+ Add Contractor</button>
                                    </div>
                                </div>
                            )}

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
                            <div className="add-product-name flex-col">
                                <p>Notes</p>
                                <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                            </div>
                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {contractorsModalWork && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Manage Contractors — {contractorsModalWork.workType}</h2>
                        {contractorsLoading ? (
                            <div className="admin-empty-state"><p>Loading…</p></div>
                        ) : (
                            <div className="list-table" style={{ marginBottom: '16px' }}>
                                <div className="list-table-format title" style={{ gridTemplateColumns: '1.5fr 1.5fr 100px' }}>
                                    <b>Contractor</b><b>Notes</b><b>Action</b>
                                </div>
                                {workContractors.map(a => (
                                    <div key={a._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.5fr 1.5fr 100px' }}>
                                        <p>{a.contractorVendorId?.name || '—'}</p>
                                        <p>{a.notes || '—'}</p>
                                        <div className="action-buttons">
                                            <p onClick={() => removeWorkContractor(a._id)} className="cursor delete-action">X</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="add-product-name flex-col">
                            <p>Add Contractor</p>
                            <div className="point-input">
                                <div style={{ flex: 1 }}>
                                    <ContractorOrLabourPicker url={url} value={newContractorVendorId} onChange={setNewContractorVendorId} />
                                </div>
                                <input type="text" placeholder="Notes (optional)" value={newContractorNotes}
                                    onChange={e => setNewContractorNotes(e.target.value)} style={{ flex: 1 }} />
                                <button type="button" className="add-point-btn" disabled={contractorsSaving} onClick={addWorkContractor}>
                                    {contractorsSaving ? 'Adding…' : '+ Add'}
                                </button>
                            </div>
                        </div>
                        <div className="edit-modal-actions">
                            <span />
                            <button type="button" className="add-btn" onClick={closeContractorsModal}>Done</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove Work?</h3>
                        <p className="bin-confirm-name">"{confirmItem.workType}"</p>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
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

export default WorksManager;
