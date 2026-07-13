import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const STATUS_LABEL = { active: 'Active', completed: 'Completed' };

const emptyForm = { workType: '', teamId: '', workOrderNumber: '', startDate: '', estimatedAreaSqft: '', status: 'active', notes: '' };

/* Manages financeWork rows for one project — the individual work items
   (e.g. "Putty" done by "Team A") that measurements get logged against.
   completedAreaSqft is read-only here; it's only ever moved by the
   measurement-save automation on the backend. */
const WorksManager = ({ url, projectId }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [works, setWorks] = useState([]);
    const [teams, setTeams] = useState([]);
    const [teamRates, setTeamRates] = useState([]);
    const [workTypeOptions, setWorkTypeOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

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
        axios.get(`${url}/api/finance/teams/list`, authHeader).then(res => { if (res.data.success) setTeams(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/team-rates/list`, { ...authHeader, params: { projectId } }).then(res => { if (res.data.success) setTeamRates(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'work_type' } })
            .then(res => { if (res.data.success) setWorkTypeOptions(res.data.data.map(s => s.name)); }).catch(() => {});
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
    const openEdit = (w) => {
        setEditingId(w._id);
        setForm({
            workType: w.workType, teamId: w.teamId?._id || w.teamId || '',
            workOrderNumber: w.workOrderNumber || '', startDate: w.startDate ? new Date(w.startDate).toISOString().slice(0, 10) : '',
            estimatedAreaSqft: w.estimatedAreaSqft, status: w.status, notes: w.notes || '',
        });
        setModalOpen(true);
    };
    const closeModal = () => { setModalOpen(false); setEditingId(null); };
    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.workType.trim()) return toast.error('Work type is required');
        if (!form.teamId) return toast.error('Team is required');
        if (!form.estimatedAreaSqft || Number(form.estimatedAreaSqft) <= 0) return toast.error('Estimated area is required');

        setSaving(true);
        try {
            const payload = { ...form, projectId };
            const endpoint = editingId ? 'update' : 'add';
            if (editingId) payload._id = editingId;
            const res = await axios.post(`${url}/api/finance/works/${endpoint}`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Work saved');
                closeModal();
                await fetchWorks();
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
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchWorks(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing work'); }
        finally { setDeleting(false); }
    };

    const earningsFor = (w) => {
        const teamId = w.teamId?._id || w.teamId;
        const rate = teamRates.find(r => (r.teamId?._id || r.teamId) === teamId && r.workType === w.workType);
        if (!rate) return null;
        const perUnit = rate.paymentBasis === 'per_day' ? rate.ratePerDay : rate.ratePerSqft;
        return w.completedAreaSqft * perUnit;
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
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.2fr 1fr 1.3fr 1fr 1fr 200px' }}>
                    <b>Work Type</b><b>Team</b><b>Completed / Estimated</b><b>Earnings</b><b>Status</b><b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : works.length === 0 ? (
                    <div className="admin-empty-state"><p>No works yet for this project.</p></div>
                ) : (
                    works.map(w => {
                        const earnings = earningsFor(w);
                        const pct = w.estimatedAreaSqft > 0 ? Math.min(100, Math.round((w.completedAreaSqft / w.estimatedAreaSqft) * 100)) : 0;
                        return (
                            <div key={w._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.2fr 1fr 1.3fr 1fr 1fr 200px' }}>
                                <p>{w.workType}</p>
                                <p>{w.teamId?.name || '—'}</p>
                                <p>{w.completedAreaSqft} / {w.estimatedAreaSqft} sqft ({pct}%)</p>
                                <p>{earnings != null ? `₹${earnings.toLocaleString('en-IN')}` : '—'}</p>
                                <p><span className="item-category">{STATUS_LABEL[w.status]}</span></p>
                                <div className="action-buttons">
                                    <p onClick={() => navigate(`/finance/projects/${projectId}/works/${w._id}`)} className="cursor edit-action">Details</p>
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
                                <input type="text" list="work-type-options" value={form.workType} onChange={e => setField('workType', e.target.value)} />
                                <datalist id="work-type-options">
                                    {workTypeOptions.map(w => <option key={w} value={w} />)}
                                </datalist>
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Team *</p>
                                <select value={form.teamId} onChange={e => setField('teamId', e.target.value)}>
                                    <option value="">Select team…</option>
                                    {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                </select>
                            </div>
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
