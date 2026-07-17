import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useWebSocket } from '../../hooks/useWebSocket';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import AddMeasurementModal from './AddMeasurementModal';
import '../../styles/list.css';
import '../../styles/wizard.css';

const toDateKey = (d) => new Date(d).toISOString().slice(0, 10);

/*
 * Read-only, filtered view of a project's day-to-day measurements — entry
 * itself happens from Site Operations (contractor) / Labour Measurements
 * (labour), both reachable across every project, so duplicating that form
 * here just risked the two drifting apart. Pick a Work Type and a Date and
 * see everything logged against it that day, contractor and labour teams
 * together, grouped by the actual Work (mirrors ContractorRatesManager /
 * WorkersManager's "group header + row" pattern).
 */
const WorkMeasurementsSummary = ({ url, projectId, worksVersion }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [works, setWorks] = useState([]);
    const [contractorMeasurements, setContractorMeasurements] = useState([]);
    const [labourMeasurements, setLabourMeasurements] = useState([]);
    const [loading, setLoading] = useState(true);

    const [workType, setWorkType] = useState('');
    const [date, setDate] = useState('');
    const [addModalOpen, setAddModalOpen] = useState(false);

    const fetchAll = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const [worksRes, contractorRes, labourRes] = await Promise.all([
                axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId } }),
                axios.get(`${url}/api/finance/measurements/list`, { ...authHeader, params: { projectId } }),
                axios.get(`${url}/api/finance/labour-measurements/list`, { ...authHeader, params: { projectId } }),
            ]);
            if (worksRes.data.success) setWorks(worksRes.data.data);
            if (contractorRes.data.success) setContractorMeasurements(contractorRes.data.data);
            if (labourRes.data.success) setLabourMeasurements(labourRes.data.data);
        } catch { toast.error('Error fetching measurements'); }
        finally { setLoading(false); }
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchAll(); }, [fetchAll, worksVersion]);

    useWebSocket(useCallback((msg) => {
        if (msg.projectId !== projectId) return;
        if (['financeMeasurementsChanged', 'financeLabourMeasurementsChanged', 'financeWorksChanged'].includes(msg.type)) fetchAll();
    }, [projectId, fetchAll]));

    const workTypeOptions = [...new Set(works.map(w => w.workType))];

    const toggleApprove = async (m) => {
        try {
            const res = await axios.post(`${url}/api/finance/measurements/update`, { _id: m._id, engineerApproved: !m.engineerApproved }, authHeader);
            if (res.data.success) { toast.success('Updated'); await fetchAll(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error updating measurement'); }
    };

    const removeContractorMeasurement = async (m) => {
        try {
            const res = await axios.delete(`${url}/api/finance/measurements/remove`, { ...authHeader, data: { _id: m._id } });
            if (res.data.success) { toast.success(res.data.message); await fetchAll(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing measurement'); }
    };

    const removeLabourMeasurement = async (m) => {
        try {
            const res = await axios.post(`${url}/api/finance/labour-measurements/remove`, { _id: m._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchAll(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing measurement'); }
    };

    // Combine both types into one shape, filtered to the chosen scope, then
    // grouped by the actual Work (there can be more than one Work sharing
    // the same work type on a project).
    const matchesScope = (m) => m.workId?.workType === workType && toDateKey(m.date) === date;

    const groups = new Map(); // workId -> { workType, workOrderNumber, rows: [] }
    if (workType && date) {
        for (const m of contractorMeasurements) {
            if (!matchesScope(m)) continue;
            const key = m.workId._id;
            if (!groups.has(key)) groups.set(key, { workType: m.workId.workType, workOrderNumber: m.workId.workOrderNumber, rows: [] });
            groups.get(key).rows.push({ kind: 'contractor', data: m });
        }
        for (const m of labourMeasurements) {
            if (!matchesScope(m)) continue;
            const key = m.workId._id;
            if (!groups.has(key)) groups.set(key, { workType: m.workId.workType, workOrderNumber: m.workId.workOrderNumber, rows: [] });
            groups.get(key).rows.push({ kind: 'labour', data: m });
        }
        // Contractor rows first, then labour rows clustered by supervisor.
        for (const g of groups.values()) {
            g.rows.sort((a, b) => {
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

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;

    return (
        <div>
            <div className="wizard-field-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: '20px' }}>
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
                    <button type="button" className="add-btn" style={{ width: '100%' }} onClick={() => setAddModalOpen(true)}>
                        + Add New Measurement
                    </button>
                </div>
            </div>

            {addModalOpen && (
                <AddMeasurementModal
                    url={url} projectId={projectId} works={works}
                    onClose={() => setAddModalOpen(false)}
                    onSaved={fetchAll}
                />
            )}

            {!workType || !date ? (
                <div className="admin-empty-state"><p>Select a work type and a date to see that day's measurements.</p></div>
            ) : totalRows === 0 ? (
                <div className="admin-empty-state"><p>No measurements logged for {workType} on {new Date(date).toLocaleDateString()}.</p></div>
            ) : (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '12px' }}>
                        {totalRows} {totalRows === 1 ? 'entry' : 'entries'} for {workType} on {new Date(date).toLocaleDateString()}
                    </p>
                    <div className="list-table">
                        {[...groups.entries()].filter(([, g]) => g.rows.length > 0).map(([workId, g]) => (
                            <div key={workId}>
                                <div className="rate-group-header">
                                    <span className="rate-group-bar" />
                                    <b>{g.workType}{g.workOrderNumber ? ` (${g.workOrderNumber})` : ''}</b>
                                </div>
                                <div className="list-table-format title" style={{ gridTemplateColumns: '1.8fr 1fr 1fr 1.4fr 90px' }}>
                                    <b>Logged By</b><b>Area Covered</b><b>Approved</b><b>Remarks</b><b>Action</b>
                                </div>
                                {g.rows.map(({ kind, data: m }) => (
                                    <div key={m._id} className="list-table-format row-item rate-row" style={{ gridTemplateColumns: '1.8fr 1fr 1fr 1.4fr 90px' }}>
                                        {kind === 'contractor' ? (
                                            <div>
                                                <p style={{ margin: 0 }}>{m.contractorVendorId?.name || '—'}</p>
                                                <span className="item-category" style={{ marginTop: '4px' }}>Contractor</span>
                                            </div>
                                        ) : (
                                            <div>
                                                <p style={{ margin: 0 }}>{m.labourerId?.name || '—'}</p>
                                                <span className="admin-subtitle" style={{ display: 'block', margin: '2px 0 4px' }}>
                                                    Team: {m.supervisorId?.name || '—'}
                                                </span>
                                                <span className="item-category">Labour</span>
                                            </div>
                                        )}
                                        <p>{m.areaCoveredSqft} sqft</p>
                                        {kind === 'contractor' ? (
                                            <p onClick={() => toggleApprove(m)} className="cursor" style={{ color: m.engineerApproved ? 'var(--moss)' : 'var(--text-lt)' }}>
                                                {m.engineerApproved ? '✓ Approved' : 'Pending'}
                                            </p>
                                        ) : (
                                            <p style={{ color: 'var(--text-lt)' }}>—</p>
                                        )}
                                        <p>{m.remarks || '—'}</p>
                                        <div className="action-buttons">
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
