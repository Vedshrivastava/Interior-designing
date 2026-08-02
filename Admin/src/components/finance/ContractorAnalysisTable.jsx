import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import StyledSelect from './StyledSelect';
import '../../styles/list.css';

// Same dashboardCache idea as FinanceHome.jsx, keyed by projectId ('' means
// "all projects", itself a valid cacheable key) since this table's data
// changes with the picker — a bare singleton would show project A's rows
// after switching to project B.
const contractorAnalysisCache = new Map();

/* Same balancePayable formula as the individual Contractor Ledger
   (Contractors > Ledger tab) — every labour contractor in one comparable
   table instead of picking one at a time. Optional project filter. */
const ContractorAnalysisTable = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectId, setProjectId] = useState('');
    const [rows, setRows] = useState(contractorAnalysisCache.get('') || []);
    const [loading, setLoading] = useState(!contractorAnalysisCache.has(''));

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {}).finally(() => setProjectsLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchRows = () => {
        axios.get(`${url}/api/finance/reports/contractor-analysis`, { ...authHeader, params: projectId ? { projectId } : {} })
            .then(res => { if (res.data.success) { setRows(res.data.data); contractorAnalysisCache.set(projectId, res.data.data); } })
            .catch(() => toast.error('Error fetching contractor analysis'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const cached = contractorAnalysisCache.get(projectId);
        if (cached) { setRows(cached); setLoading(false); }
        else setLoading(true);
        fetchRows();
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh([
        'financeVendorsChanged', 'financeWorkContractorAssignmentsChanged', 'financeWorksChanged',
        'financeContractorRatesChanged', 'financeMeasurementsChanged', 'financeContractorLedgerChanged',
    ], fetchRows);

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project (optional)</p>
                <StyledSelect value={projectId} onChange={setProjectId} placeholder="All projects" loading={projectsLoading} options={projects.map(p => ({ value: p._id, label: p.name }))} />
            </div>

            <div className="dash-chart-card rca-card">
                <div className="rca-row rca-header">
                    <b className="rca-contractor">Contractor</b>
                    <b className="rca-total">Total</b>
                    <b className="rca-approved">Approved</b>
                    <b className="rca-advances">Advances</b>
                    <b className="rca-deductions">Deductions</b>
                    <b className="rca-directpay">Direct Pay</b>
                    <b className="rca-payments">Payments</b>
                    <b className="rca-tds">TDS</b>
                    <b className="rca-balance">Balance Payable</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : rows.length === 0 ? (
                    <div className="admin-empty-state"><p>No labour contractors yet.</p></div>
                ) : rows.map(r => (
                    <div key={r.vendorId} className="rca-row">
                        <p className="rca-contractor">{r.vendorName}</p>
                        <p className="rca-total"><span className="pq-group-label">Total</span>₹{r.totalAmount.toLocaleString('en-IN')}</p>
                        <p className="rca-approved" style={{ color: r.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}><span className="pq-group-label">Approved</span>{r.earnings > 0 ? `₹${r.earnings.toLocaleString('en-IN')}` : 'Unapproved'}</p>
                        <p className="rca-advances"><span className="pq-group-label">Advances</span>₹{r.advances.toLocaleString('en-IN')}</p>
                        <p className="rca-deductions"><span className="pq-group-label">Deductions</span>₹{r.deductions.toLocaleString('en-IN')}</p>
                        <p className="rca-directpay"><span className="pq-group-label">Direct Pay</span>₹{r.directPaymentTotal.toLocaleString('en-IN')}</p>
                        <p className="rca-payments"><span className="pq-group-label">Payments</span>₹{r.payments.toLocaleString('en-IN')}</p>
                        <p className="rca-tds"><span className="pq-group-label">TDS</span>₹{r.tdsTotal.toLocaleString('en-IN')}</p>
                        <p className="rca-balance" style={{ fontWeight: 600, color: r.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}><span className="pq-group-label">Balance Payable</span>₹{r.balancePayable.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContractorAnalysisTable;
