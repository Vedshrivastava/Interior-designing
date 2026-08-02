import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import StyledSelect from './StyledSelect';
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
                <StyledSelect value={projectId} onChange={setProjectId} placeholder="All projects" options={projects.map(p => ({ value: p._id, label: p.name }))} />
            </div>

            <div className="dash-chart-card rva-card">
                <div className="rva-row rva-header">
                    <b className="rva-vendor">Vendor</b>
                    <b className="rva-purchases">Purchases</b>
                    <b className="rva-returns">Returns</b>
                    <b className="rva-payments">Payments</b>
                    <b className="rva-owed">Amount Owed</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : rows.length === 0 ? (
                    <div className="admin-empty-state"><p>No material vendors yet.</p></div>
                ) : rows.map(r => (
                    <div key={r.vendorId} className="rva-row">
                        <p className="rva-vendor">{r.vendorName}</p>
                        <p className="rva-purchases"><span className="pq-group-label">Purchases</span>₹{r.purchases.toLocaleString('en-IN')}</p>
                        <p className="rva-returns"><span className="pq-group-label">Returns</span>₹{r.returns.toLocaleString('en-IN')}</p>
                        <p className="rva-payments"><span className="pq-group-label">Payments</span>₹{r.payments.toLocaleString('en-IN')}</p>
                        <p className="rva-owed" style={{ fontWeight: 600, color: r.amountOwed > 0 ? '#c0392b' : 'var(--moss)' }}><span className="pq-group-label">Amount Owed</span>₹{r.amountOwed.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VendorAnalysisTable;
