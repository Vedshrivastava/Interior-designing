import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import LabourLedgerView from '../../components/finance/LabourLedgerView';
import SupervisorAttendanceManager from '../../components/finance/SupervisorAttendanceManager';
import SupervisorIncentivesManager from '../../components/finance/SupervisorIncentivesManager';
import SupervisorDeductionsManager from '../../components/finance/SupervisorDeductionsManager';
import SalaryLedgerView from '../../components/finance/SalaryLedgerView';
import QuickAddPicker from '../../components/finance/QuickAddPicker';
import '../../styles/list.css';

const TABS = [
    { key: 'projects',    label: 'Assigned Projects' },
    { key: 'team',        label: 'Team' },
    { key: 'labour',      label: 'Labour Ledger' },
    { key: 'attendance',  label: 'Attendance' },
    { key: 'performance', label: 'Performance' },
    { key: 'salary',      label: 'Salary' },
    { key: 'incentives',  label: 'Incentives' },
    { key: 'deductions',  label: 'Deductions' },
];

/* Read-only — a labourer isn't owned by any supervisor, so this is
   computed fresh from financeWorkLabourAssignment rather than a stored
   roster: every labourer currently on a team under this supervisor,
   across every Work, right now. The same labourer can appear here today
   and under a different supervisor's Team tab on a future project once
   this one wraps up. */
const SupervisorTeamTab = ({ url, supervisorId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { supervisorId } })
            .then(res => { if (res.data.success) setRows(res.data.data); })
            .finally(() => setLoading(false));
    }, [url, supervisorId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (rows.length === 0) return <div className="admin-empty-state"><p>Not currently running a team on any Work.</p></div>;

    return (
        <div className="list-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 1.3fr' }}>
                <b>Labourer</b><b>Project</b><b>Work Type</b><b>Notes</b>
            </div>
            {rows.map(a => (
                <div key={a._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 1.3fr' }}>
                    <p>{a.labourerId?.name || '—'}</p>
                    <p>{a.workId?.projectId?.name || '—'}</p>
                    <p>{a.workId?.workType || '—'}</p>
                    <p>{a.notes || '—'}</p>
                </div>
            ))}
        </div>
    );
};

/* One labourer's ledger, picked from among this supervisor's current team
   (derived the same way as the Team tab above, not a stored roster) —
   every labourer is paid individually via their own ledger. */
const SupervisorLabourLedgerTab = ({ url, supervisorId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [team, setTeam] = useState([]);
    const [labourerId, setLabourerId] = useState('');

    useEffect(() => {
        setLabourerId('');
        axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { supervisorId } })
            .then(res => {
                if (!res.data.success) return;
                const byId = new Map();
                res.data.data.forEach(a => { if (a.labourerId) byId.set(a.labourerId._id, a.labourerId); });
                setTeam([...byId.values()]);
            }).catch(() => {});
    }, [url, supervisorId]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Labourer</p>
                <select value={labourerId} onChange={e => setLabourerId(e.target.value)}>
                    <option value="">Select labourer…</option>
                    {team.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
            </div>
            {labourerId
                ? <LabourLedgerView url={url} labourerId={labourerId} />
                : <div className="admin-empty-state"><p>Select a labourer currently on this supervisor's team to view their ledger.</p></div>}
        </div>
    );
};

/*
 * A Supervisor is a financeEmployee, not a separate entity — there's no
 * "isSupervisor" flag on that schema, so this picker lists every
 * employee (same as Masters > Employees). Same "picker on the same page"
 * pattern as Contractors/Procurement/Masters' own ledger tabs.
 */
const EmployeePicker = ({ url, selectedEmployeeId, onChange }) => (
    <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
        <p>Supervisor</p>
        <QuickAddPicker url={url} resourceKey="employees" value={selectedEmployeeId} onChange={onChange} placeholder="Select employee…" />
    </div>
);

/* Projects whose assignedSupervisorId matches this employee — falls back
   to the legacy assignedSupervisor string (name match) for old projects
   that predate the ref field, so they don't just disappear from the list. */
const AssignedProjectsTab = ({ url, employeeId, employeeName }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => {
                if (!res.data.success) return;
                const matched = res.data.data.filter(p =>
                    (p.assignedSupervisorId?._id || p.assignedSupervisorId) === employeeId
                    || (!p.assignedSupervisorId && p.assignedSupervisor && p.assignedSupervisor === employeeName)
                );
                setProjects(matched);
            })
            .finally(() => setLoading(false));
    }, [url, employeeId, employeeName]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (projects.length === 0) return <div className="admin-empty-state"><p>No projects assigned to this supervisor.</p></div>;

    return (
        <div className="list-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
                <b>Project</b><b>Status</b><b>Contract Type</b>
            </div>
            {projects.map(p => (
                <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
                    <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/projects/${p._id}`)}>{p.name}</p>
                    <p><span className="item-category">{p.status}</span></p>
                    <p>{p.contractType}</p>
                </div>
            ))}
        </div>
    );
};

const SupervisorsPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedEmployeeName, setSelectedEmployeeName] = useState('');

    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const onSelectEmployee = async (id) => {
        setSelectedEmployeeId(id);
        if (!id) { setSelectedEmployeeName(''); return; }
        try {
            const res = await axios.get(`${url}/api/finance/employees/list`, authHeader);
            if (res.data.success) setSelectedEmployeeName(res.data.data.find(e => e._id === id)?.name || '');
        } catch { /* fallback string-match just won't apply if this fails */ }
    };

    return (
        <FinanceTabShell
            label="Supervisors"
            subtitle="A supervisor is a Master Data employee — pick one to see their assigned projects, current labour team, attendance, salary, incentives, and deductions."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            <EmployeePicker url={url} selectedEmployeeId={selectedEmployeeId} onChange={onSelectEmployee} />

            {!selectedEmployeeId ? (
                <div className="admin-empty-state"><p>Select a supervisor to continue.</p></div>
            ) : (
                <>
                    {activeTab === 'projects' && <AssignedProjectsTab url={url} employeeId={selectedEmployeeId} employeeName={selectedEmployeeName} />}
                    {activeTab === 'team' && <SupervisorTeamTab url={url} supervisorId={selectedEmployeeId} />}
                    {activeTab === 'labour' && <SupervisorLabourLedgerTab url={url} supervisorId={selectedEmployeeId} />}
                    {activeTab === 'attendance' && <SupervisorAttendanceManager url={url} employeeId={selectedEmployeeId} />}
                    {activeTab === 'performance' && <PlaceholderTab text="No defined performance metric to build against yet." />}
                    {activeTab === 'salary' && <SalaryLedgerView url={url} employeeId={selectedEmployeeId} />}
                    {activeTab === 'incentives' && <SupervisorIncentivesManager url={url} employeeId={selectedEmployeeId} />}
                    {activeTab === 'deductions' && <SupervisorDeductionsManager url={url} employeeId={selectedEmployeeId} />}
                </>
            )}
        </FinanceTabShell>
    );
};

export default SupervisorsPage;
