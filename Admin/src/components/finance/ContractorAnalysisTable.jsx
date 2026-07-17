import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
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
    const [projectId, setProjectId] = useState('');
    const [rows, setRows] = useState(contractorAnalysisCache.get('') || []);
    const [loading, setLoading] = useState(!contractorAnalysisCache.has(''));

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const cached = contractorAnalysisCache.get(projectId);
        if (cached) { setRows(cached); setLoading(false); }
        else setLoading(true);
        axios.get(`${url}/api/finance/reports/contractor-analysis`, { ...authHeader, params: projectId ? { projectId } : {} })
            .then(res => { if (res.data.success) { setRows(res.data.data); contractorAnalysisCache.set(projectId, res.data.data); } })
            .catch(() => toast.error('Error fetching contractor analysis'))
            .finally(() => setLoading(false));
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project (optional)</p>
                <select value={projectId} onChange={e => setProjectId(e.target.value)}>
                    <option value="">All projects</option>
                    {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
            </div>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1fr' }}>
                    <b>Contractor</b><b>Earnings</b><b>Advances</b><b>Deductions</b><b>Payments</b><b>Balance Payable</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : rows.length === 0 ? (
                    <div className="admin-empty-state"><p>No labour contractors yet.</p></div>
                ) : rows.map(r => (
                    <div key={r.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1fr' }}>
                        <p>{r.vendorName}</p>
                        <p>₹{r.earnings.toLocaleString('en-IN')}</p>
                        <p>₹{r.advances.toLocaleString('en-IN')}</p>
                        <p>₹{r.deductions.toLocaleString('en-IN')}</p>
                        <p>₹{r.payments.toLocaleString('en-IN')}</p>
                        <p style={{ fontWeight: 600, color: r.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{r.balancePayable.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContractorAnalysisTable;
