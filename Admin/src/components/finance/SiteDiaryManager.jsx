import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';

const STATUS_FILTER_OPTIONS = [
    { value: 'open', label: 'Open Issues' },
    { value: 'resolved', label: 'Resolved' },
];
const TYPE_OPTIONS = [
    { value: 'note', label: 'Note' },
    { value: 'issue', label: 'Issue' },
];
const todayKey = () => new Date().toISOString().slice(0, 10);
const emptyForm = { projectId: '', date: todayKey(), entryType: 'note', loggedBy: '', note: '' };

/*
 * Daily site notes and an issues log, on the same timeline. Dual-mode, same
 * pattern as WorkMeasurementsSummary: `projectId` fixed → scoped to one
 * project (a project's own Diary tab); omitted → cross-project (Site
 * Operations' Site Diary), with a Project picker and column added.
 *
 * Issues get an Open/Resolved workflow (a "Mark Resolved" action); Notes
 * are just a dated log line with no status. Delete is immediate on click,
 * same as Expenses/Measurements — no confirmation modal, which this
 * codebase reserves for higher-blast-radius deletes (a whole Work, a whole
 * Bill), not simple log entries.
 */
const SiteDiaryManager = ({ url, projectId: fixedProjectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const crossProject = !fixedProjectId;

    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [resolvingId, setResolvingId] = useState(null);

    const fetchProjects = () => {
        if (!crossProject) return;
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    };
    useEffect(fetchProjects, [url, crossProject]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (fixedProjectId) params.projectId = fixedProjectId;
            else if (selectedProject) params.projectId = selectedProject;
            if (statusFilter) params.status = statusFilter;
            const res = await axios.get(`${url}/api/finance/site-diary/list`, { ...authHeader, params });
            if (res.data.success) setEntries(res.data.data);
        } catch { toast.error('Error fetching site diary'); }
        finally { setLoading(false); }
    }, [url, fixedProjectId, selectedProject, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchEntries(); }, [fetchEntries]);
    useFinanceWsRefresh(['financeSiteDiaryChanged'], fetchEntries);

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const openAdd = () => {
        setForm({ ...emptyForm, projectId: fixedProjectId || selectedProject || '' });
        setModalOpen(true);
    };
    const closeModal = () => setModalOpen(false);

    const submit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const projectId = fixedProjectId || form.projectId;
        if (!projectId) return toast.error('Project is required');
        if (!form.date) return toast.error('Date is required');
        if (!form.note.trim()) return toast.error('Entry text is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/site-diary/add`, { ...form, projectId }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                closeModal();
                await fetchEntries();
            } else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error logging entry'); }
        finally { setSaving(false); }
    };

    const resolveIssue = async (entry) => {
        setResolvingId(entry._id);
        try {
            const res = await axios.post(`${url}/api/finance/site-diary/resolve`, { _id: entry._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error resolving issue'); }
        finally { setResolvingId(null); }
    };

    const remove = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/site-diary/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) { toast.success(res.data.message); await fetchEntries(); }
            else toast.error(res.data.message || 'Error removing entry');
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing entry'); }
    };

    const columns = ['1fr', crossProject && '1.3fr', '1fr', '1fr', '1fr', '2.2fr', '160px'].filter(Boolean).join(' ');

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {crossProject && (
                        <div className="add-product-name flex-col" style={{ minWidth: '220px' }}>
                            <p>Project</p>
                            <StyledSelect
                                value={selectedProject} onChange={setSelectedProject} placeholder="All Projects"
                                options={projects.map(p => ({ value: p._id, label: p.name }))}
                            />
                        </div>
                    )}
                    <div className="add-product-name flex-col" style={{ minWidth: '180px' }}>
                        <p>Status</p>
                        <StyledSelect value={statusFilter} onChange={setStatusFilter} placeholder="All Entries" options={STATUS_FILTER_OPTIONS} />
                    </div>
                </div>
                <button type="button" className="add-btn" onClick={openAdd}>+ Add Entry</button>
            </div>

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Log Site Diary Entry</h2>
                        <form onSubmit={submit}>
                            <div className="wizard-field-grid">
                                {crossProject && (
                                    <div className="add-product-name flex-col">
                                        <p>Project *</p>
                                        <StyledSelect
                                            value={form.projectId} onChange={v => setField('projectId', v)} placeholder="Select project…"
                                            options={projects.map(p => ({ value: p._id, label: p.name }))}
                                        />
                                    </div>
                                )}
                                <div className="add-product-name flex-col">
                                    <p>Date *</p>
                                    <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Type</p>
                                    <StyledSelect value={form.entryType} onChange={v => setField('entryType', v)} options={TYPE_OPTIONS} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Logged By (optional)</p>
                                    <input type="text" value={form.loggedBy} onChange={e => setField('loggedBy', e.target.value)} placeholder="Supervisor / site name" />
                                </div>
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Entry *</p>
                                    <textarea rows="3" value={form.note} onChange={e => setField('note', e.target.value)} placeholder="What happened on site today?" />
                                </div>
                            </div>
                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Log Entry'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : entries.length === 0 ? (
                <div className="admin-empty-state"><p>No diary entries yet.</p></div>
            ) : (
                <div className="list-table finance-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: columns }}>
                        <b>Date</b>
                        {crossProject && <b>Project</b>}
                        <b>Type</b><b>Status</b><b>Logged By</b><b>Entry</b><b>Action</b>
                    </div>
                    {entries.map(entry => (
                        <div key={entry._id} className="list-table-format row-item" style={{ gridTemplateColumns: columns }}>
                            <p>{new Date(entry.date).toLocaleDateString()}</p>
                            {crossProject && <p>{entry.projectId?.name || '-'}</p>}
                            <p>
                                <span className="item-category" style={entry.entryType === 'issue' ? { color: '#c0392b' } : undefined}>
                                    {entry.entryType === 'issue' ? 'Issue' : 'Note'}
                                </span>
                            </p>
                            <p>
                                {entry.entryType === 'issue' ? (
                                    <span className="item-category" style={{ color: entry.status === 'resolved' ? 'var(--moss)' : '#b8860b' }}>
                                        {entry.status === 'resolved' ? 'Resolved' : 'Open'}
                                    </span>
                                ) : '-'}
                            </p>
                            <p>{entry.loggedBy || '-'}</p>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{entry.note}</p>
                            <div className="action-buttons" style={{ flexWrap: 'wrap', rowGap: '6px' }}>
                                {entry.entryType === 'issue' && entry.status === 'open' && (
                                    <p onClick={() => resolvingId !== entry._id && resolveIssue(entry)} className="cursor edit-action">
                                        {resolvingId === entry._id ? 'Resolving…' : 'Mark Resolved'}
                                    </p>
                                )}
                                <p onClick={() => remove(entry._id)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SiteDiaryManager;
