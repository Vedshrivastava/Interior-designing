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
const labourAnalysisCache = new Map();

/* Labour-side mirror of ContractorAnalysisTable — same balancePayable
   formula as the individual Labour Ledger, every labourer in one
   comparable table instead of picking one at a time. Optional project
   filter. */
const LabourAnalysisTable = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState('');
    const [rows, setRows] = useState(labourAnalysisCache.get('') || []);
    const [loading, setLoading] = useState(!labourAnalysisCache.has(''));

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchRows = () => {
        axios.get(`${url}/api/finance/reports/labour-analysis`, { ...authHeader, params: projectId ? { projectId } : {} })
            .then(res => { if (res.data.success) { setRows(res.data.data); labourAnalysisCache.set(projectId, res.data.data); } })
            .catch(() => toast.error('Error fetching labour analysis'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const cached = labourAnalysisCache.get(projectId);
        if (cached) { setRows(cached); setLoading(false); }
        else setLoading(true);
        fetchRows();
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh([
        'financeLabourersChanged', 'financeWorkLabourAssignmentsChanged', 'financeWorksChanged',
        'financeLabourRatesChanged', 'financeMeasurementsChanged', 'financeLabourLedgerChanged',
    ], fetchRows);

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project (optional)</p>
                <StyledSelect value={projectId} onChange={setProjectId} placeholder="All projects" options={projects.map(p => ({ value: p._id, label: p.name }))} />
            </div>

            <div className="dash-chart-card rla-card">
                <div className="rla-row rla-header">
                    <b className="rla-labourer">Labourer</b>
                    <b className="rla-total">Total</b>
                    <b className="rla-approved">Approved</b>
                    <b className="rla-advances">Advances</b>
                    <b className="rla-deductions">Deductions</b>
                    <b className="rla-directpay">Direct Pay</b>
                    <b className="rla-payments">Payments</b>
                    <b className="rla-tds">TDS</b>
                    <b className="rla-balance">Balance Payable</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : rows.length === 0 ? (
                    <div className="admin-empty-state"><p>No labourers yet.</p></div>
                ) : rows.map(r => (
                    <div key={r.labourerId} className="rla-row">
                        <p className="rla-labourer">{r.labourerName}</p>
                        <p className="rla-total"><span className="pq-group-label">Total</span>₹{r.totalAmount.toLocaleString('en-IN')}</p>
                        <p className="rla-approved" style={{ color: r.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}><span className="pq-group-label">Approved</span>{r.earnings > 0 ? `₹${r.earnings.toLocaleString('en-IN')}` : 'Unapproved'}</p>
                        <p className="rla-advances"><span className="pq-group-label">Advances</span>₹{r.advances.toLocaleString('en-IN')}</p>
                        <p className="rla-deductions"><span className="pq-group-label">Deductions</span>₹{r.deductions.toLocaleString('en-IN')}</p>
                        <p className="rla-directpay"><span className="pq-group-label">Direct Pay</span>₹{r.directPaymentTotal.toLocaleString('en-IN')}</p>
                        <p className="rla-payments"><span className="pq-group-label">Payments</span>₹{r.payments.toLocaleString('en-IN')}</p>
                        <p className="rla-tds"><span className="pq-group-label">TDS</span>₹{r.tdsTotal.toLocaleString('en-IN')}</p>
                        <p className="rla-balance" style={{ fontWeight: 600, color: r.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}><span className="pq-group-label">Balance Payable</span>₹{r.balancePayable.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LabourAnalysisTable;
