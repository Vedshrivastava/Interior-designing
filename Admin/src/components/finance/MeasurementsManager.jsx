import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const emptyForm = { workId: '', teamId: '', date: '', supervisorName: '', areaCoveredSqft: '', remarks: '' };

/*
 * Daily Site Entry — used both scoped to one project (ProjectDetail's
 * Measurements tab, `projectId` prop set) and unscoped (Site Operations'
 * Daily Measurements tab, no `projectId` — a project picker is shown
 * first). Saving triggers the backend automation: increments the work's
 * completedAreaSqft and creates `consume` stock movements when the
 * project tracks material.
 */
const MeasurementsManager = ({ url, projectId: fixedProjectId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(fixedProjectId || '');
    const [projectDetail, setProjectDetail] = useState(null);
    const [works, setWorks] = useState([]);
    const [workTeams, setWorkTeams] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [measurements, setMeasurements] = useState([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState(emptyForm);
    const [materialLines, setMaterialLines] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (fixedProjectId) return;
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url, fixedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        axios.get(`${url}/api/finance/materials/list`, authHeader).then(res => { if (res.data.success) setMaterials(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchMeasurements = async (pid) => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/measurements/list`, { ...authHeader, params: { projectId: pid } });
            if (res.data.success) setMeasurements(res.data.data);
        } catch { toast.error('Error fetching measurements'); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (!selectedProjectId) { setProjectDetail(null); setWorks([]); setMeasurements([]); return; }
        axios.get(`${url}/api/finance/projects/${selectedProjectId}`, authHeader)
            .then(res => { if (res.data.success) setProjectDetail(res.data.data.project); }).catch(() => {});
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId: selectedProjectId } })
            .then(res => { if (res.data.success) setWorks(res.data.data); }).catch(() => {});
        fetchMeasurements(selectedProjectId);
    }, [url, selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Scoped to only the teams currently assigned to the selected Work —
    // not every team system-wide.
    useEffect(() => {
        if (!form.workId) { setWorkTeams([]); return; }
        axios.get(`${url}/api/finance/work-team-assignments/list`, { ...authHeader, params: { workId: form.workId } })
            .then(res => { if (res.data.success) setWorkTeams(res.data.data); })
            .catch(() => setWorkTeams([]));
    }, [url, form.workId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => {
        const next = { ...prev, [key]: value };
        if (key === 'workId') next.teamId = ''; // scoped team list changes with the work
        return next;
    });
    const addMaterialLine = () => setMaterialLines(prev => [...prev, { materialId: '', quantity: '' }]);
    const setMaterialLine = (idx, key, value) => setMaterialLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: value } : l));
    const removeMaterialLine = (idx) => setMaterialLines(prev => prev.filter((_, i) => i !== idx));

    const resetForm = () => { setForm(emptyForm); setMaterialLines([]); setPhotos([]); };

    const submit = async (e) => {
        e.preventDefault();
        if (!selectedProjectId) return toast.error('Select a project');
        if (!form.workId) return toast.error('Work is required');
        if (!form.teamId) return toast.error('Team is required');
        if (!form.date) return toast.error('Date is required');
        if (!form.areaCoveredSqft || Number(form.areaCoveredSqft) <= 0) return toast.error('Area covered must be greater than zero');

        const validLines = materialLines.filter(l => l.materialId && Number(l.quantity) > 0);

        const data = new FormData();
        data.append('projectId', selectedProjectId);
        data.append('workId', form.workId);
        data.append('teamId', form.teamId);
        data.append('date', form.date);
        data.append('supervisorName', form.supervisorName);
        data.append('areaCoveredSqft', form.areaCoveredSqft);
        data.append('remarks', form.remarks);
        data.append('materialUsed', JSON.stringify(validLines));
        photos.forEach(f => data.append('photos', f));

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/measurements/add`, data, {
                headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
            });
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

    const toggleApprove = async (m) => {
        try {
            const res = await axios.post(`${url}/api/finance/measurements/update`, { _id: m._id, engineerApproved: !m.engineerApproved }, authHeader);
            if (res.data.success) { toast.success('Updated'); await fetchMeasurements(selectedProjectId); }
            else toast.error(res.data.message);
        } catch { toast.error('Error updating measurement'); }
    };

    const removeMeasurement = async (m) => {
        try {
            const res = await axios.delete(`${url}/api/finance/measurements/remove`, { ...authHeader, data: { _id: m._id } });
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
                                <p>Team *</p>
                                <select value={form.teamId} onChange={e => setField('teamId', e.target.value)} disabled={!form.workId}>
                                    <option value="">{form.workId ? 'Select team…' : 'Select a work first'}</option>
                                    {workTeams.map(a => <option key={a._id || a.teamId?._id} value={a.teamId?._id || a.teamId}>{a.teamId?.name}</option>)}
                                </select>
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Date *</p>
                                <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Supervisor</p>
                                <input type="text" value={form.supervisorName} onChange={e => setField('supervisorName', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Area Covered (sqft) *</p>
                                <input type="number" value={form.areaCoveredSqft} onChange={e => setField('areaCoveredSqft', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Photos</p>
                                <input type="file" multiple accept="image/*" onChange={e => setPhotos(Array.from(e.target.files))} />
                            </div>
                            <div className="add-product-name flex-col wizard-field-full">
                                <p>Remarks</p>
                                <textarea rows="2" value={form.remarks} onChange={e => setField('remarks', e.target.value)} />
                            </div>
                        </div>

                        {projectDetail?.materialTrackingEnabled && (
                            <div style={{ marginTop: '16px' }}>
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

                        <div className="wizard-actions" style={{ marginTop: '20px' }}>
                            <span />
                            <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save Measurement'}</button>
                        </div>
                    </form>

                    <div className="list-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr 1fr 100px' }}>
                            <b>Date</b><b>Work</b><b>Team</b><b>Area Covered</b><b>Supervisor</b><b>Approved</b><b>Action</b>
                        </div>
                        {loading ? (
                            <div className="admin-empty-state"><p>Loading…</p></div>
                        ) : measurements.length === 0 ? (
                            <div className="admin-empty-state"><p>No measurements logged yet.</p></div>
                        ) : (
                            measurements.map(m => (
                                <div key={m._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr 1fr 100px' }}>
                                    <p>{new Date(m.date).toLocaleDateString()}</p>
                                    <p>{m.workId?.workType || '—'}</p>
                                    <p>{m.teamId?.name || (m.workId ? 'legacy' : '—')}</p>
                                    <p>{m.areaCoveredSqft} sqft</p>
                                    <p>{m.supervisorName || '—'}</p>
                                    <p onClick={() => toggleApprove(m)} className="cursor" style={{ color: m.engineerApproved ? 'var(--moss)' : 'var(--text-lt)' }} title={m.engineerApproved && m.engineerApprovedBy ? `Approved by ${m.engineerApprovedBy}` : ''}>
                                        {m.engineerApproved ? '✓ Approved' : 'Pending'}
                                    </p>
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

export default MeasurementsManager;
