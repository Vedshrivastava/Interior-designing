import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import ExpensesManager from '../../components/finance/ExpensesManager';
import ExpenseAnalysisView from '../../components/finance/ExpenseAnalysisView';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const OTHER_CATEGORY = 'Others';

// Kept outside their components so each survives a route remount, same
// dashboardCache pattern as FinanceHome.jsx — revisiting a tab paints
// instantly from the last-known rows instead of redoing the N+1 ledger
// fan-out and sitting on "Loading…" again, while a fresh fetch quietly
// brings it up to date in the background.
let vendorPayablesCache = null;
let contractorPayablesCache = null;
let salaryPayablesCache = null;
let commissionPayablesCache = null;

const TABS = [
    { key: 'vendor',           label: 'Vendor' },
    { key: 'contractor',       label: 'Contractor' },
    { key: 'salary',           label: 'Salary' },
    { key: 'commission',       label: 'Commission' },
    { key: 'expenses',         label: 'Expenses' },
    { key: 'expense-analysis', label: 'Expense Analysis' },
    { key: 'company',          label: 'Company Expenses' },
    { key: 'other',            label: 'Other Expenses' },
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
    const [rows, setRows] = useState(contractorPayablesCache || []);
    const [loading, setLoading] = useState(!contractorPayablesCache);

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
                if (!cancelled) {
                    const next = ledgers.filter(Boolean).sort((a, b) => b.balancePayable - a.balancePayable);
                    setRows(next);
                    contractorPayablesCache = next;
                }
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
    const [rows, setRows] = useState(vendorPayablesCache || []);
    const [loading, setLoading] = useState(!vendorPayablesCache);

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
                if (!cancelled) {
                    const next = ledgers.filter(Boolean).sort((a, b) => b.amountOwed - a.amountOwed);
                    setRows(next);
                    vendorPayablesCache = next;
                }
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

/* Balance due per employee for the current month, pulled from the salary
   ledger endpoint — same N+1 pattern as the tabs above. Always shows the
   running month; switch employees' own Salary Ledger (under Masters)
   for history across other months. */
const PayablesSalaryTab = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const month = thisMonth();
    // Cached per month, not just once — "For June" and "For July" are
    // genuinely different data, so a cache hit only counts if it's for
    // the same month this render is asking about.
    const cacheHit = salaryPayablesCache?.month === month ? salaryPayablesCache.rows : null;
    const [rows, setRows] = useState(cacheHit || []);
    const [loading, setLoading] = useState(!cacheHit);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const employeesRes = await axios.get(`${url}/api/finance/employees/list`, authHeader);
                const employees = employeesRes.data.success ? employeesRes.data.data : [];
                const ledgers = await Promise.all(employees.map(e =>
                    axios.get(`${url}/api/finance/employees/${e._id}/salary-ledger`, { ...authHeader, params: { month } })
                        .then(res => (res.data.success ? res.data.data : null))
                        .catch(() => null)
                ));
                if (!cancelled) {
                    const next = ledgers.filter(Boolean).sort((a, b) => b.balanceDue - a.balanceDue);
                    setRows(next);
                    salaryPayablesCache = { month, rows: next };
                }
            } catch {
                if (!cancelled) toast.error('Error fetching salary payables');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (rows.length === 0) return <div className="admin-empty-state"><p>No employees yet.</p></div>;

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>For {month}</p>
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                    <b>Employee</b><b>Expected</b><b>Paid</b><b>Balance Due</b>
                </div>
                {rows.map(r => (
                    <div key={r.employeeId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                        <p>{r.employeeName}</p>
                        <p>₹{r.expectedSalary.toLocaleString('en-IN')}</p>
                        <p>₹{r.paid.toLocaleString('en-IN')}</p>
                        <p style={{ fontWeight: 600, color: r.balanceDue > 0 ? '#c0392b' : 'var(--moss)' }}>₹{r.balanceDue.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* Commission payable per referral vendor, pulled from the commission
   ledger endpoint — same N+1 pattern as the tabs above. */
const PayablesCommissionTab = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [rows, setRows] = useState(commissionPayablesCache || []);
    const [loading, setLoading] = useState(!commissionPayablesCache);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const vendorsRes = await axios.get(`${url}/api/finance/vendors/list`, authHeader);
                const referrals = vendorsRes.data.success ? vendorsRes.data.data.filter(v => v.vendorType === 'referral') : [];
                const ledgers = await Promise.all(referrals.map(v =>
                    axios.get(`${url}/api/finance/vendors/${v._id}/commission-ledger`, authHeader)
                        .then(res => (res.data.success ? { vendorId: v._id, vendorName: v.name, ...res.data.data.totals } : null))
                        .catch(() => null)
                ));
                if (!cancelled) {
                    const next = ledgers.filter(Boolean).sort((a, b) => b.commissionPayable - a.commissionPayable);
                    setRows(next);
                    commissionPayablesCache = next;
                }
            } catch {
                if (!cancelled) toast.error('Error fetching commission payables');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (rows.length === 0) return <div className="admin-empty-state"><p>No referral vendors yet.</p></div>;

    return (
        <div className="list-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                <b>Referral Vendor</b><b>Earned</b><b>Payments</b><b>Commission Payable</b>
            </div>
            {rows.map(r => (
                <div key={r.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                    <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate('/finance/procurement')}>{r.vendorName}</p>
                    <p>₹{r.earnings.toLocaleString('en-IN')}</p>
                    <p>₹{r.payments.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 600, color: r.commissionPayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{r.commissionPayable.toLocaleString('en-IN')}</p>
                </div>
            ))}
        </div>
    );
};

const PayablesPage = ({ url }) => {
    const [searchParams] = useSearchParams();
    // Supports deep-linking in from a project's own Expenses tab's
    // "Details" action: ?tab=expenses opens straight to the full log, and
    // ?expenseId= scrolls to + briefly highlights that one row.
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || TABS[0].key);
    const [companyId, setCompanyId] = useState('');
    const [companyName, setCompanyName] = useState('Company');
    const token = localStorage.getItem('token');

    useEffect(() => {
        axios.get(`${url}/api/finance/settings/company`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => { if (res.data.success) { setCompanyId(res.data.data._id); setCompanyName(res.data.data.companyName); } })
            .catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <FinanceTabShell
            label="Payables"
            subtitle="Computed from vendor balance + contractor balance + unpaid salary + unpaid commission — never a directly-writable record. Expenses/Expense Analysis/Company Expenses/Other Expenses are reads of the expense log instead, not a ledger."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'vendor' && <PayablesVendorTab url={url} />}
            {activeTab === 'contractor' && <PayablesContractorTab url={url} />}
            {activeTab === 'salary' && <PayablesSalaryTab url={url} />}
            {activeTab === 'commission' && <PayablesCommissionTab url={url} />}
            {activeTab === 'expenses' && <ExpensesManager url={url} highlightId={searchParams.get('expenseId')} />}
            {activeTab === 'expense-analysis' && <ExpenseAnalysisView url={url} />}
            {activeTab === 'company' && companyId && (
                <ExpensesManager url={url} fixedRelatedTo={{ type: 'financeCompanySettings', id: companyId, label: `${companyName} Expenses` }} />
            )}
            {activeTab === 'other' && <ExpensesManager url={url} fixedCategory={OTHER_CATEGORY} />}
        </FinanceTabShell>
    );
};

export default PayablesPage;
