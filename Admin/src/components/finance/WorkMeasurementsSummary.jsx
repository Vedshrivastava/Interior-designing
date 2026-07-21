import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import AddMeasurementModal from './AddMeasurementModal';
import '../../styles/list.css';
import '../../styles/wizard.css';

const toDateKey = (d) => new Date(d).toISOString().slice(0, 10);

/*
 * Read-only, filtered view of day-to-day measurements — entry itself
 * happens via the "+ Add New Measurement" dialog alongside these same
 * filters. Pick a Work Type and a Date and see everything logged against
 * it that day, contractor and labour teams together, grouped by the
 * actual Work (mirrors ContractorRatesManager / WorkersManager's "group
 * header + row" pattern).
 *
 * Dual-mode, same pattern as the old MeasurementsManager/
 * LabourMeasurementsManager: `projectId` fixed → scoped to one project
 * (a project's own Measurements tab); omitted → cross-project (Site
 * Operations' Daily Measurements), grouped by Project instead of Work,
 * with a Work column added since a Project can have more than one Work
 * of the chosen type.
 */
const WorkMeasurementsSummary = ({ url, projectId: fixedProjectId, worksVersion }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const crossProject = !fixedProjectId;

    const [works, setWorks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [contractorMeasurements, setContractorMeasurements] = useState([]);
    const [labourMeasurements, setLabourMeasurements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [measurementsLoading, setMeasurementsLoading] = useState(false);

    const [selectedProject, setSelectedProject] = useState('');
    const [workType, setWorkType] = useState('');
    const [date, setDate] = useState('');
    const [addModalOpen, setAddModalOpen] = useState(false);

    const fetchProjects = () => {
        if (!crossProject) return;
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    };
    useEffect(fetchProjects, [url, crossProject]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    // Works power the Work Type dropdown and row grouping/labels — needed
    // regardless of which date is selected, so fetched independently of
    // (and far less often than) the day's measurements below.
    const fetchWorks = useCallback(async () => {
        setLoading(true);
        try {
            const params = fixedProjectId ? { projectId: fixedProjectId } : {};
            const res = await axios.get(`${url}/api/finance/works/list`, { ...authHeader, params });
            if (res.data.success) setWorks(res.data.data);
        } catch { toast.error('Error fetching works'); }
        finally { setLoading(false); }
    }, [url, fixedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchWorks(); }, [fetchWorks, worksVersion]);

    // Scoped to one calendar day — this view only ever displays one day's
    // rows at a time (see the `!workType || !date` gate in the render
    // below), so there's no reason to pull every measurement ever logged
    // (cross-project, that's the entire company's history) just to filter
    // almost all of it out client-side. That used to be exactly what
    // happened here on every load and after every add/remove, and got
    // slower — a long, whole-page "Loading…" — as the log grew.
    const fetchMeasurements = useCallback(async () => {
        if (!date) { setContractorMeasurements([]); setLabourMeasurements([]); return; }
        setMeasurementsLoading(true);
        try {
            const params = fixedProjectId ? { projectId: fixedProjectId, date } : { date };
            const [contractorRes, labourRes] = await Promise.all([
                axios.get(`${url}/api/finance/measurements/list`, { ...authHeader, params }),
                axios.get(`${url}/api/finance/labour-measurements/list`, { ...authHeader, params }),
            ]);
            if (contractorRes.data.success) setContractorMeasurements(contractorRes.data.data);
            if (labourRes.data.success) setLabourMeasurements(labourRes.data.data);
        } catch { toast.error('Error fetching measurements'); }
        finally { setMeasurementsLoading(false); }
    }, [url, fixedProjectId, date]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchMeasurements(); }, [fetchMeasurements]);

    useWebSocket(useCallback((msg) => {
        if (fixedProjectId && msg.projectId !== fixedProjectId) return;
        if (msg.type === 'financeWorksChanged') fetchWorks();
        if (['financeMeasurementsChanged', 'financeLabourMeasurementsChanged'].includes(msg.type)) fetchMeasurements();
    }, [fixedProjectId, fetchWorks, fetchMeasurements]));

    const setProjectFilter = (v) => { setSelectedProject(v); setWorkType(''); };

    const worksInScope = selectedProject
        ? works.filter(w => (w.projectId?._id || w.projectId) === selectedProject)
        : works;
    const workTypeOptions = [...new Set(worksInScope.map(w => w.workType))];

    // Prefills the Add Measurement dialog's Work field so re-logging
    // another entry for the same work/day doesn't require re-picking it —
    // only resolvable when the current filters already narrow to one
    // project (fixedProjectId, or a Project chosen in the cross-project
    // filter above); otherwise the modal has no project to look Works up
    // against either.
    const defaultWorkId = (fixedProjectId || selectedProject)
        ? (worksInScope.find(w => w.workType === workType)?._id || '')
        : '';

    const removeContractorMeasurement = async (m) => {
        try {
            const res = await axios.delete(`${url}/api/finance/measurements/remove`, { ...authHeader, data: { _id: m._id } });
            if (res.data.success) { toast.success(res.data.message); await fetchMeasurements(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing measurement'); }
    };

    const removeLabourMeasurement = async (m) => {
        try {
            const res = await axios.post(`${url}/api/finance/labour-measurements/remove`, { _id: m._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchMeasurements(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing measurement'); }
    };

    // Combine both types into one shape, filtered to the chosen scope, then
    // grouped — by the actual Work when scoped to one project (there can be
    // more than one Work sharing the same work type on a project), or by
    // Project when cross-project (a Work column is added instead, since a
    // project can itself have more than one matching Work).
    const matchesScope = (m) => {
        if (m.workId?.workType !== workType || toDateKey(m.date) !== date) return false;
        if (selectedProject && (m.projectId?._id || m.projectId) !== selectedProject) return false;
        return true;
    };

    const groups = new Map();
    if (workType && date) {
        const pushRow = (m, kind) => {
            const key = crossProject ? (m.projectId?._id || m.projectId) : m.workId._id;
            if (!groups.has(key)) {
                groups.set(key, crossProject
                    ? { label: m.projectId?.name || '-', rows: [] }
                    : { label: `${m.workId.workType}${m.workId.workOrderNumber ? ` (${m.workId.workOrderNumber})` : ''}`, rows: [] });
            }
            groups.get(key).rows.push({ kind, data: m });
        };
        for (const m of contractorMeasurements) { if (matchesScope(m)) pushRow(m, 'contractor'); }
        for (const m of labourMeasurements) { if (matchesScope(m)) pushRow(m, 'labour'); }

        // Contractor rows first, then labour rows clustered by supervisor —
        // and when cross-project, clustered by Work first since a group can
        // span more than one Work of the same type.
        for (const g of groups.values()) {
            g.rows.sort((a, b) => {
                if (crossProject) {
                    const wa = a.data.workId?.workOrderNumber || a.data.workId?._id || '';
                    const wb = b.data.workId?.workOrderNumber || b.data.workId?._id || '';
                    if (wa !== wb) return String(wa).localeCompare(String(wb));
                }
                if (a.kind !== b.kind) return a.kind === 'contractor' ? -1 : 1;
                if (a.kind === 'labour') {
                    const sa = a.data.supervisorId?.name || '';
                    const sb = b.data.supervisorId?.name || '';
                    if (sa !== sb) return sa.localeCompare(sb);
                }
                return 0;
            });
        }
    }

    const totalRows = [...groups.values()].reduce((sum, g) => sum + g.rows.length, 0);
    // No "Approved" column — that was never the real approval (see
    // RunningBillsManager.jsx's Generate Bill flow, which is where sqft
    // actually gets confirmed now, per work type not per daily entry).
    // These rows stay a pure log of what was done — proof and data, not a
    // pending/approved status.
    const columns = crossProject ? '1.3fr 1.6fr 1fr 1.3fr 150px' : '1.8fr 1fr 1.4fr 150px';

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;

    return (
        <div>
            <div
                className="wizard-field-grid"
                style={{
                    gridTemplateColumns: crossProject
                        ? 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(230px,1.4fr)'
                        : 'minmax(0,1fr) minmax(0,1fr) minmax(230px,1.4fr)',
                    marginBottom: '20px',
                }}
            >
                {crossProject && (
                    <div className="add-product-name flex-col">
                        <p>Project</p>
                        <StyledSelect
                            value={selectedProject} onChange={setProjectFilter} placeholder="All Projects"
                            options={projects.map(p => ({ value: p._id, label: p.name }))}
                        />
                    </div>
                )}
                <div className="add-product-name flex-col">
                    <p>Work Type</p>
                    <StyledSelect
                        value={workType} onChange={setWorkType} placeholder="Select work type…"
                        options={workTypeOptions.map(w => ({ value: w, label: w }))}
                    />
                </div>
                <div className="add-product-name flex-col">
                    <p>Date</p>
                    <StyledDatePicker value={date} onChange={setDate} />
                </div>
                <div className="add-product-name flex-col">
                    <p aria-hidden="true" style={{ visibility: 'hidden' }}>Add</p>
                    <button
                        type="button" className="add-btn"
                        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid transparent', margin: 0, whiteSpace: 'nowrap' }}
                        onClick={() => setAddModalOpen(true)}
                    >
                        + Add New Measurement
                    </button>
                </div>
            </div>

            {addModalOpen && (
                <AddMeasurementModal
                    url={url} projectId={fixedProjectId} defaultProjectId={selectedProject}
                    defaultDate={date} defaultWorkId={defaultWorkId}
                    onClose={() => setAddModalOpen(false)}
                    onSaved={fetchMeasurements}
                />
            )}

            {!workType || !date ? (
                <div className="admin-empty-state"><p>Select a work type and a date to see that day's measurements.</p></div>
            ) : measurementsLoading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : totalRows === 0 ? (
                <div className="admin-empty-state"><p>No measurements logged for {workType} on {new Date(date).toLocaleDateString()}.</p></div>
            ) : (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '12px' }}>
                        {totalRows} {totalRows === 1 ? 'entry' : 'entries'} for {workType} on {new Date(date).toLocaleDateString()}
                    </p>
                    <div className="list-table">
                        {[...groups.entries()].filter(([, g]) => g.rows.length > 0).map(([key, g]) => (
                            <div key={key}>
                                <div className="rate-group-header">
                                    <span className="rate-group-bar" />
                                    <b>{g.label}</b>
                                </div>
                                <div className="list-table-format title" style={{ gridTemplateColumns: columns }}>
                                    {crossProject && <b>Work</b>}
                                    <b>Logged By</b><b>Area Covered</b><b>Remarks</b><b>Action</b>
                                </div>
                                {g.rows.map(({ kind, data: m }) => (
                                    <div key={m._id} className="list-table-format row-item rate-row" style={{ gridTemplateColumns: columns }}>
                                        {crossProject && (
                                            <p>{m.workId?.workType}{m.workId?.workOrderNumber ? ` (${m.workId.workOrderNumber})` : ''}</p>
                                        )}
                                        {kind === 'contractor' ? (
                                            <div>
                                                <p style={{ margin: 0 }}>{m.contractorVendorId?.name || '-'}</p>
                                                <span className="item-category" style={{ marginTop: '4px' }}>Contractor</span>
                                            </div>
                                        ) : (
                                            <div>
                                                <p style={{ margin: 0 }}>{m.labourerId?.name || '-'}</p>
                                                <span className="admin-subtitle" style={{ display: 'block', margin: '2px 0 4px' }}>
                                                    Team: {m.supervisorId?.name || '-'}
                                                </span>
                                                <span className="item-category">Labour</span>
                                            </div>
                                        )}
                                        <p>{m.areaCoveredSqft} sqft</p>
                                        <p>{m.remarks || '-'}</p>
                                        <div className="action-buttons">
                                            <p
                                                onClick={() => navigate(`/finance/projects/${crossProject ? (m.projectId?._id || m.projectId) : fixedProjectId}/works/${m.workId?._id || m.workId}?date=${toDateKey(m.date)}`)}
                                                className="cursor edit-action"
                                            >
                                                Details
                                            </p>
                                            <p onClick={() => (kind === 'contractor' ? removeContractorMeasurement(m) : removeLabourMeasurement(m))} className="cursor delete-action">X</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default WorkMeasurementsSummary;
