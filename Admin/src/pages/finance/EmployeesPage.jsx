import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import LabourLedgerView from '../../components/finance/LabourLedgerView';
import SupervisorAttendanceManager from '../../components/finance/SupervisorAttendanceManager';
import SupervisorIncentivesManager from '../../components/finance/SupervisorIncentivesManager';
import SupervisorDeductionsManager from '../../components/finance/SupervisorDeductionsManager';
import SalaryLedgerView from '../../components/finance/SalaryLedgerView';
import QuickAddPicker from '../../components/finance/QuickAddPicker';
import PersonDocumentsView from '../../components/finance/PersonDocumentsView';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';

/* Every tab except Directory operates on one picked employee — the
   supervisor-only tabs below only make sense for a financeEmployee whose
   role is 'supervisor' (Assigned Projects/Team/Labour Ledger all key off
   supervisor-shaped data: financeProject.assignedSupervisorId,
   financeWorkLabourAssignment.supervisorId). A 'staff' employee (Data
   Entry, Social Media, etc.) never has any of that, so those tabs would
   only ever render an empty state for them — hidden instead, with the
   employee's Role (set via Directory's Add/Edit form) deciding which set
   applies. Everything else (Attendance/Salary/Incentives/Deductions/
   Documents) is genuinely generic per employee, supervisor or not.
   (Performance was removed — it never had a defined metric behind it,
   just a permanent placeholder tab.) */
const ALL_TABS = [
    { key: 'directory',   label: 'Directory' },
    { key: 'projects',    label: 'Assigned Projects', supervisorOnly: true },
    { key: 'team',        label: 'Team',              supervisorOnly: true },
    { key: 'labour',      label: 'Labour Ledger',     supervisorOnly: true },
    { key: 'attendance',  label: 'Attendance' },
    { key: 'salary',      label: 'Salary' },
    { key: 'incentives',  label: 'Incentives' },
    { key: 'deductions',  label: 'Deductions' },
    { key: 'documents',   label: 'Documents' },
];
const tabsForRole = (role) => ALL_TABS.filter(t => t.key === 'directory' || !t.supervisorOnly || role === 'supervisor');

/* Read-only — a labourer isn't owned by any supervisor, so this is
   computed fresh from financeWorkLabourAssignment rather than a stored
   roster: every labourer currently on a team under this supervisor,
   across every Work, right now. */
const SupervisorTeamTab = ({ url, supervisorId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRows = () => {
        setLoading(true);
        axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { supervisorId } })
            .then(res => { if (res.data.success) setRows(res.data.data); })
            .finally(() => setLoading(false));
    };
    useEffect(fetchRows, [url, supervisorId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeWorkLabourAssignmentsChanged'], fetchRows);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (rows.length === 0) return <div className="admin-empty-state"><p>Not currently running a team on any Work.</p></div>;

    return (
        <div className="list-table finance-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 1.3fr' }}>
                <b>Labourer</b><b>Project</b><b>Work Type</b><b>Notes</b>
            </div>
            {rows.map(a => (
                <div key={a._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1.3fr 1fr 1.3fr' }}>
                    <p>{a.labourerId?.name || '-'}</p>
                    <p>{a.workId?.projectId?.name || '-'}</p>
                    <p>{a.workId?.workType || '-'}</p>
                    <p>{a.notes || '-'}</p>
                </div>
            ))}
        </div>
    );
};

/* One labourer's ledger, picked from among this supervisor's current team
   (derived the same way as the Team tab above, not a stored roster). */
const SupervisorLabourLedgerTab = ({ url, supervisorId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [team, setTeam] = useState([]);
    const [labourerId, setLabourerId] = useState('');

    const fetchTeam = () => {
        axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { supervisorId } })
            .then(res => {
                if (!res.data.success) return;
                const byId = new Map();
                res.data.data.forEach(a => { if (a.labourerId) byId.set(a.labourerId._id, a.labourerId); });
                setTeam([...byId.values()]);
            }).catch(() => {});
    };
    useEffect(() => { setLabourerId(''); fetchTeam(); }, [url, supervisorId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeWorkLabourAssignmentsChanged'], fetchTeam);

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

/* Projects whose assignedSupervisorId matches this employee — falls back
   to the legacy assignedSupervisor string (name match) for old projects
   that predate the ref field, so they don't just disappear from the list. */
const AssignedProjectsTab = ({ url, employeeId, employeeName }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchProjects = () => {
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
    };
    useEffect(fetchProjects, [url, employeeId, employeeName]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (projects.length === 0) return <div className="admin-empty-state"><p>No projects assigned to this supervisor.</p></div>;

    return (
        <div className="list-table finance-table">
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

const EmployeePicker = ({ url, selectedEmployeeId, onChange, selectedEmployee }) => (
    <div style={{ marginBottom: '20px' }}>
        <div className="add-product-name flex-col" style={{ maxWidth: '480px' }}>
            <p>Employee</p>
            <QuickAddPicker url={url} resourceKey="employees" value={selectedEmployeeId} onChange={onChange} placeholder="Select employee…" />
        </div>
        {selectedEmployee && (
            <p className="admin-subtitle" style={{ marginTop: '8px' }}>
                <span className="item-category">{selectedEmployee.role === 'supervisor' ? 'Supervisor' : 'Staff'}</span>
                {selectedEmployee.designation ? ` · ${selectedEmployee.designation}` : ''}
            </p>
        )}
    </div>
);

/*
 * Relocated out of Master Data (per user request) — Add Employee and
 * Salary Ledger no longer live under Masters, which is meant for
 * dropdown/enum lists and the material catalog, not people. Directory
 * keeps the exact same MasterCrudTable (add/edit/delete, full field set
 * including Role) Masters used to render for the 'employees' tab; every
 * other tab is a "pick one employee" section page, same pattern as
 * Supervisors — role decides which of those sections actually apply
 * (see ALL_TABS above). Supervisors itself stays a separate sidebar entry
 * for now; once this page is confirmed to cover everything it does, that
 * page/entry gets removed and folded in here instead.
 */
const EmployeesPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState('directory');
    const [employees, setEmployees] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const fetchEmployees = () => {
        axios.get(`${url}/api/finance/employees/list`, authHeader)
            .then(res => { if (res.data.success) setEmployees(res.data.data); })
            .catch(() => {});
    };
    useEffect(fetchEmployees, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeEmployeesChanged'], fetchEmployees);

    const selectedEmployee = employees.find(e => e._id === selectedEmployeeId) || null;
    const visibleTabs = tabsForRole(selectedEmployee?.role);

    // If the newly-picked (or newly-role-edited) employee no longer has the
    // currently active tab available (e.g. switched from a supervisor to a
    // staff employee while on "Team"), fall back to Directory rather than
    // rendering a dead tab.
    useEffect(() => {
        if (!visibleTabs.some(t => t.key === activeTab)) setActiveTab('directory');
    }, [selectedEmployeeId, selectedEmployee?.role]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <FinanceTabShell
            label="Employees"
            subtitle="Company staff and supervisors: add/edit the employee directory, or pick one employee to view their assigned projects, team, attendance, salary, incentives, and deductions."
            tabs={visibleTabs}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'directory' ? (
                <MasterCrudTable url={url} resourceKey="employees" />
            ) : (
                <>
                    <EmployeePicker url={url} selectedEmployeeId={selectedEmployeeId} onChange={setSelectedEmployeeId} selectedEmployee={selectedEmployee} />

                    {!selectedEmployeeId ? (
                        <div className="admin-empty-state"><p>Select an employee to continue.</p></div>
                    ) : (
                        <>
                            {activeTab === 'projects' && <AssignedProjectsTab url={url} employeeId={selectedEmployeeId} employeeName={selectedEmployee?.name} />}
                            {activeTab === 'team' && <SupervisorTeamTab url={url} supervisorId={selectedEmployeeId} />}
                            {activeTab === 'labour' && <SupervisorLabourLedgerTab url={url} supervisorId={selectedEmployeeId} />}
                            {activeTab === 'attendance' && <SupervisorAttendanceManager url={url} employeeId={selectedEmployeeId} />}
                            {activeTab === 'salary' && <SalaryLedgerView url={url} employeeId={selectedEmployeeId} />}
                            {activeTab === 'incentives' && <SupervisorIncentivesManager url={url} employeeId={selectedEmployeeId} />}
                            {activeTab === 'deductions' && <SupervisorDeductionsManager url={url} employeeId={selectedEmployeeId} />}
                            {activeTab === 'documents' && <PersonDocumentsView url={url} resourceKey="employees" entityId={selectedEmployeeId} entityLabel="employee" />}
                        </>
                    )}
                </>
            )}
        </FinanceTabShell>
    );
};

export default EmployeesPage;
