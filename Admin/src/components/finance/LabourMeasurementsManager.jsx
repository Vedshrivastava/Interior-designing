import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';

const emptyForm = { workId: '', labourerId: '', date: '', areaCoveredSqft: '', remarks: '' };

/*
 * Daily per-labourer measurement entry — replaces the old attendance-based
 * Daily Labour system. Used both scoped to one project (ProjectDetail's
 * Labour tab, `projectId` prop set) and unscoped (a global Daily
 * Measurements-style view, no `projectId` — a project picker is shown
 * first), same pattern as the Contractor MeasurementsManager. No
 * engineerApproved gate here — every logged sqft counts toward the
 * labourer's earnings immediately; correction happens afterward via a
 * financeLabourDeduction on that labourer's ledger.
 */
const LabourMeasurementsManager = ({ url, projectId: fixedProjectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(fixedProjectId || '');
    const [works, setWorks] = useState([]);
    const [workLabourers, setWorkLabourers] = useState([]);
    const [measurements, setMeasurements] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const fetchProjects = () => {
        if (fixedProjectId) return;
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    };
    useEffect(fetchProjects, [url, fixedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    const fetchMeasurements = async (pid) => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/labour-measurements/list`, { ...authHeader, params: { projectId: pid } });
            if (res.data.success) setMeasurements(res.data.data);
        } catch { toast.error('Error fetching measurements'); }
        finally { setLoading(false); }
    };

    const fetchWorksForSelectedProject = () => {
        if (!selectedProjectId) { setWorks([]); return; }
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId: selectedProjectId } })
            .then(res => { if (res.data.success) setWorks(res.data.data); }).catch(() => {});
    };
    useEffect(() => {
        if (!selectedProjectId) { setMeasurements([]); return; }
        fetchWorksForSelectedProject();
        fetchMeasurements(selectedProjectId);
    }, [url, selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeWorksChanged'], fetchWorksForSelectedProject);

    // Scoped to only the labourers currently assigned to the selected Work
    // — not every labourer system-wide.
    useEffect(() => {
        if (!form.workId) { setWorkLabourers([]); return; }
        axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { workId: form.workId } })
            .then(res => { if (res.data.success) setWorkLabourers(res.data.data); })
            .catch(() => setWorkLabourers([]));
    }, [url, form.workId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => {
        const next = { ...prev, [key]: value };
        if (key === 'workId') next.labourerId = ''; // scoped labourer list changes with the work
        return next;
    });

    const resetForm = () => setForm(emptyForm);

    const submit = async (e) => {
        e.preventDefault();
        if (!selectedProjectId) return toast.error('Select a project');
        if (!form.workId) return toast.error('Work is required');
        if (!form.labourerId) return toast.error('Labourer is required');
        if (!form.date) return toast.error('Date is required');
        if (!form.areaCoveredSqft || Number(form.areaCoveredSqft) <= 0) return toast.error('Area covered must be greater than zero');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/labour-measurements/add`, {
                projectId: selectedProjectId, workId: form.workId, labourerId: form.labourerId,
                date: form.date, areaCoveredSqft: form.areaCoveredSqft, remarks: form.remarks,
            }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                resetForm();
                await Promise.all([
                    fetchMeasurements(selectedProjectId),
                    axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId: selectedProjectId } }).then(r => { if (r.data.success) setWorks(r.data.data); }),
                ]);
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving measurement');
        } finally { setSaving(false); }
    };

    const removeMeasurement = async (m) => {
        try {
            const res = await axios.post(`${url}/api/finance/labour-measurements/remove`, { _id: m._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchMeasurements(selectedProjectId); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing measurement'); }
    };

    return (
        <div>
            {!fixedProjectId && (
                <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                    <p>Project</p>
                    <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
                        <option value="">Select project…</option>
                        {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                </div>
            )}

            {!selectedProjectId ? (
                <div className="admin-empty-state"><p>Select a project to log a measurement.</p></div>
            ) : (
                <>
                    <form onSubmit={submit} style={{ marginBottom: '28px' }}>
                        <div className="wizard-field-grid">
                            <div className="add-product-name flex-col">
                                <p>Work *</p>
                                <select value={form.workId} onChange={e => setField('workId', e.target.value)}>
                                    <option value="">Select work…</option>
                                    {works.map(w => <option key={w._id} value={w._id}>{w.workType}{w.workOrderNumber ? ` (${w.workOrderNumber})` : ''}</option>)}
                                </select>
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Labourer *</p>
                                <select value={form.labourerId} onChange={e => setField('labourerId', e.target.value)} disabled={!form.workId}>
                                    <option value="">{form.workId ? 'Select labourer…' : 'Select a work first'}</option>
                                    {workLabourers.map(a => (
                                        <option key={a._id || a.labourerId?._id} value={a.labourerId?._id || a.labourerId}>
                                            {a.labourerId?.name}{a.supervisorId?.name ? ` · ${a.supervisorId.name}'s team` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Date *</p>
                                <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Area Covered (sqft) *</p>
                                <input type="number" onWheel={e => e.target.blur()} min="0" value={form.areaCoveredSqft} onChange={e => setField('areaCoveredSqft', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col wizard-field-full">
                                <p>Remarks</p>
                                <textarea rows="2" value={form.remarks} onChange={e => setField('remarks', e.target.value)} />
                            </div>
                        </div>

                        <div className="wizard-actions" style={{ marginTop: '20px' }}>
                            <span />
                            <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save Measurement'}</button>
                        </div>
                    </form>

                    <div className="list-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr 1fr 100px' }}>
                            <b>Date</b><b>Work</b><b>Labourer</b><b>Area Covered</b><b>Action</b>
                        </div>
                        {loading ? (
                            <div className="admin-empty-state"><p>Loading…</p></div>
                        ) : measurements.length === 0 ? (
                            <div className="admin-empty-state"><p>No measurements logged yet.</p></div>
                        ) : (
                            measurements.map(m => (
                                <div key={m._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1.2fr 1fr 100px' }}>
                                    <p>{new Date(m.date).toLocaleDateString()}</p>
                                    <p>{m.workId?.workType || '-'}</p>
                                    <p>{m.labourerId?.name || '-'}</p>
                                    <p>{m.areaCoveredSqft} sqft</p>
                                    <div className="action-buttons">
                                        <p onClick={() => removeMeasurement(m)} className="cursor delete-action">X</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default LabourMeasurementsManager;
