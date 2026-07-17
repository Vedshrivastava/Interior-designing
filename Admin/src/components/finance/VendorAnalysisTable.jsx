import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';

// Same dashboardCache idea as FinanceHome.jsx, keyed by projectId ('' means
// "all projects") since this table's data changes with the picker.
const vendorAnalysisCache = new Map();

/* Same amountOwed formula as the individual Vendor Ledger (Procurement >
   Ledger tab) — every material-supplier vendor in one comparable table.
   Referral vendors aren't included here; they get their own Commission
   numbers instead (see the backend's INTERPRETATION FLAG). */
const VendorAnalysisTable = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState('');
    const [rows, setRows] = useState(vendorAnalysisCache.get('') || []);
    const [loading, setLoading] = useState(!vendorAnalysisCache.has(''));

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchRows = () => {
        axios.get(`${url}/api/finance/reports/vendor-analysis`, { ...authHeader, params: projectId ? { projectId } : {} })
            .then(res => { if (res.data.success) { setRows(res.data.data); vendorAnalysisCache.set(projectId, res.data.data); } })
            .catch(() => toast.error('Error fetching vendor analysis'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const cached = vendorAnalysisCache.get(projectId);
        if (cached) { setRows(cached); setLoading(false); }
        else setLoading(true);
        fetchRows();
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh(['financeVendorsChanged', 'financePurchasesChanged', 'financeVendorLedgerChanged'], fetchRows);

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
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr' }}>
                    <b>Vendor</b><b>Purchases</b><b>Returns</b><b>Payments</b><b>Amount Owed</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : rows.length === 0 ? (
                    <div className="admin-empty-state"><p>No material vendors yet.</p></div>
                ) : rows.map(r => (
                    <div key={r.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr' }}>
                        <p>{r.vendorName}</p>
                        <p>₹{r.purchases.toLocaleString('en-IN')}</p>
                        <p>₹{r.returns.toLocaleString('en-IN')}</p>
                        <p>₹{r.payments.toLocaleString('en-IN')}</p>
                        <p style={{ fontWeight: 600, color: r.amountOwed > 0 ? '#c0392b' : 'var(--moss)' }}>₹{r.amountOwed.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VendorAnalysisTable;
