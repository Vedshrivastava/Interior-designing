import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import PlaceholderTab from '../../components/finance/PlaceholderTab';

const TABS = [
    { key: 'vendor',     label: 'Vendor' },
    { key: 'contractor', label: 'Contractor' },
    { key: 'salary',     label: 'Salary' },
    { key: 'commission', label: 'Commission' },
    { key: 'other',      label: 'Other Expenses' },
];

/*
 * Balance payable per contractor, pulled from the same computed ledger
 * endpoint the Contractors page's Ledger tab uses — one call per
 * contractor (N+1, same pattern as Receivables' Pending Receipts list).
 * This stays purely a read of that endpoint; Payables itself is never a
 * writable collection (see the NOTE in financeNav.js and
 * controllers/financeContractorLedger.js).
 */
const PayablesContractorTab = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const vendorsRes = await axios.get(`${url}/api/finance/vendors/list`, authHeader);
                const contractors = vendorsRes.data.success ? vendorsRes.data.data.filter(v => v.vendorType === 'labour_contractor') : [];
                const ledgers = await Promise.all(contractors.map(v =>
                    axios.get(`${url}/api/finance/contractors/${v._id}/ledger`, authHeader)
                        .then(res => (res.data.success ? { vendorId: v._id, vendorName: v.name, ...res.data.data.totals } : null))
                        .catch(() => null)
                ));
                if (!cancelled) setRows(ledgers.filter(Boolean).sort((a, b) => b.balancePayable - a.balancePayable));
            } catch {
                if (!cancelled) toast.error('Error fetching contractor payables');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (rows.length === 0) return <div className="admin-empty-state"><p>No labour contractors yet.</p></div>;

    return (
        <div className="list-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1fr' }}>
                <b>Contractor</b><b>Earnings</b><b>Advances</b><b>Deductions</b><b>Payments</b><b>Balance Payable</b>
            </div>
            {rows.map(r => (
                <div key={r.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1fr' }}>
                    <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate('/finance/contractors')}>{r.vendorName}</p>
                    <p>₹{r.earnings.toLocaleString('en-IN')}</p>
                    <p>₹{r.advances.toLocaleString('en-IN')}</p>
                    <p>₹{r.deductions.toLocaleString('en-IN')}</p>
                    <p>₹{r.payments.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 600, color: r.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{r.balancePayable.toLocaleString('en-IN')}</p>
                </div>
            ))}
        </div>
    );
};

/* Amount owed per (non-contractor) vendor, pulled from the same computed
   vendor ledger endpoint Procurement's Ledger tab uses — same N+1 pattern
   as the Contractor tab above. Excludes labour_contractor vendors so a
   contractor never shows up in both tabs at once. */
const PayablesVendorTab = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const vendorsRes = await axios.get(`${url}/api/finance/vendors/list`, authHeader);
                const nonContractors = vendorsRes.data.success ? vendorsRes.data.data.filter(v => v.vendorType !== 'labour_contractor') : [];
                const ledgers = await Promise.all(nonContractors.map(v =>
                    axios.get(`${url}/api/finance/vendors/${v._id}/ledger`, authHeader)
                        .then(res => (res.data.success ? { vendorId: v._id, vendorName: v.name, ...res.data.data.totals } : null))
                        .catch(() => null)
                ));
                if (!cancelled) setRows(ledgers.filter(Boolean).sort((a, b) => b.amountOwed - a.amountOwed));
            } catch {
                if (!cancelled) toast.error('Error fetching vendor payables');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (rows.length === 0) return <div className="admin-empty-state"><p>No vendors yet.</p></div>;

    return (
        <div className="list-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr' }}>
                <b>Vendor</b><b>Purchases</b><b>Returns</b><b>Payments</b><b>Amount Owed</b>
            </div>
            {rows.map(r => (
                <div key={r.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr' }}>
                    <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate('/finance/procurement')}>{r.vendorName}</p>
                    <p>₹{r.purchases.toLocaleString('en-IN')}</p>
                    <p>₹{r.returns.toLocaleString('en-IN')}</p>
                    <p>₹{r.payments.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 600, color: r.amountOwed > 0 ? '#c0392b' : 'var(--moss)' }}>₹{r.amountOwed.toLocaleString('en-IN')}</p>
                </div>
            ))}
        </div>
    );
};

const PayablesPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);

    return (
        <FinanceTabShell
            label="Payables"
            subtitle="Computed from vendor balance + contractor balance + unpaid salary + unpaid commission + unpaid expense heads — never a directly-writable record."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'vendor' && <PayablesVendorTab url={url} />}
            {activeTab === 'contractor' && <PayablesContractorTab url={url} />}
            {activeTab === 'salary' && <PlaceholderTab text="Computed from unpaid employee salary." />}
            {activeTab === 'commission' && <PlaceholderTab text="Computed from unpaid referral commission." />}
            {activeTab === 'other' && <PlaceholderTab text="Computed from unpaid expense heads." />}
        </FinanceTabShell>
    );
};

export default PayablesPage;
