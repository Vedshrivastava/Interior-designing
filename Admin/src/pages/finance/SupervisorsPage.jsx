import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import DailyLabourManager from '../../components/finance/DailyLabourManager';
import LabourerRosterManager from '../../components/finance/LabourerRosterManager';
import SupervisorAttendanceManager from '../../components/finance/SupervisorAttendanceManager';
import SupervisorIncentivesManager from '../../components/finance/SupervisorIncentivesManager';
import SupervisorLabourPaymentsManager from '../../components/finance/SupervisorLabourPaymentsManager';
import SalaryLedgerView from '../../components/finance/SalaryLedgerView';
import QuickAddPicker from '../../components/finance/QuickAddPicker';
import '../../styles/list.css';

const TABS = [
    { key: 'projects',    label: 'Assigned Projects' },
    { key: 'roster',      label: 'Roster' },
    { key: 'labour',      label: 'Daily Labour' },
    { key: 'labourPayments', label: 'Labour Payments' },
    { key: 'attendance',  label: 'Attendance' },
    { key: 'performance', label: 'Performance' },
    { key: 'salary',      label: 'Salary' },
    { key: 'incentives',  label: 'Incentives' },
];

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
            subtitle="A supervisor is a Master Data employee — pick one to see their assigned projects, daily labour, attendance, salary, and incentives."
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
                    {activeTab === 'roster' && <LabourerRosterManager url={url} supervisorId={selectedEmployeeId} />}
                    {activeTab === 'labour' && <DailyLabourManager url={url} supervisorId={selectedEmployeeId} readOnly />}
                    {activeTab === 'labourPayments' && <SupervisorLabourPaymentsManager url={url} employeeId={selectedEmployeeId} />}
                    {activeTab === 'attendance' && <SupervisorAttendanceManager url={url} employeeId={selectedEmployeeId} />}
                    {activeTab === 'performance' && <PlaceholderTab text="No defined performance metric to build against yet." />}
                    {activeTab === 'salary' && <SalaryLedgerView url={url} employeeId={selectedEmployeeId} />}
                    {activeTab === 'incentives' && <SupervisorIncentivesManager url={url} employeeId={selectedEmployeeId} />}
                </>
            )}
        </FinanceTabShell>
    );
};

export default SupervisorsPage;
