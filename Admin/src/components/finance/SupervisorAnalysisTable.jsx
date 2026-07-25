import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import StyledSelect from './StyledSelect';
import '../../styles/list.css';

// Same dashboardCache idea as FinanceHome.jsx, keyed by projectId ('' means
// "all projects") since this table's data changes with the picker.
const supervisorAnalysisCache = new Map();

/* Supervisors are just financeEmployee rows (role: 'supervisor') — no
   per-sqft earnings concept like Contractor/Labour Analysis, so this shows
   what's actually been paid out instead: salary + incentives - deductions. */
const SupervisorAnalysisTable = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState('');
    const [rows, setRows] = useState(supervisorAnalysisCache.get('') || []);
    const [loading, setLoading] = useState(!supervisorAnalysisCache.has(''));

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchRows = () => {
        axios.get(`${url}/api/finance/reports/supervisor-analysis`, { ...authHeader, params: projectId ? { projectId } : {} })
            .then(res => { if (res.data.success) { setRows(res.data.data); supervisorAnalysisCache.set(projectId, res.data.data); } })
            .catch(() => toast.error('Error fetching supervisor analysis'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const cached = supervisorAnalysisCache.get(projectId);
        if (cached) { setRows(cached); setLoading(false); }
        else setLoading(true);
        fetchRows();
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh([
        'financeEmployeesChanged', 'financeSalaryPaymentsChanged',
        'financeSupervisorIncentivesChanged', 'financeSupervisorDeductionsChanged',
    ], fetchRows);

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project (optional)</p>
                <StyledSelect value={projectId} onChange={setProjectId} placeholder="All projects" options={projects.map(p => ({ value: p._id, label: p.name }))} />
            </div>
            {projectId && (
                <p className="admin-subtitle" style={{ marginBottom: '12px' }}>
                    Salary is always company-wide (a monthly salary isn't split across projects) — only Incentives/Deductions filter to this project.
                </p>
            )}

            <div className="list-table finance-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr' }}>
                    <b>Supervisor</b><b>Salary Paid</b><b>Incentives</b><b>Deductions</b><b>Net Paid</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : rows.length === 0 ? (
                    <div className="admin-empty-state"><p>No supervisors yet.</p></div>
                ) : rows.map(r => (
                    <div key={r.employeeId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr' }}>
                        <p>{r.employeeName}</p>
                        <p>₹{r.salaryPaid.toLocaleString('en-IN')}</p>
                        <p style={{ color: 'var(--moss)' }}>₹{r.incentiveTotal.toLocaleString('en-IN')}</p>
                        <p style={{ color: '#c0392b' }}>₹{r.deductionTotal.toLocaleString('en-IN')}</p>
                        <p style={{ fontWeight: 600 }}>₹{r.netPaid.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SupervisorAnalysisTable;
