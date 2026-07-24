import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import ExpensesManager from '../../components/finance/ExpensesManager';
import ExpenseAnalysisView from '../../components/finance/ExpenseAnalysisView';
import WorkDeductionAllocationPanel from '../../components/finance/WorkDeductionAllocationPanel';
import ClientDirectPaymentsManager from '../../components/finance/ClientDirectPaymentsManager';
import '../../styles/list.css';

// Salary for the CURRENT, still-in-progress month isn't owed yet — it's
// only actually payable once that month has fully ended, so Payables
// (what's owed right now) looks at the last completed month instead of
// the current one. Without this, a month's full salary showed as due
// from day one of that month, before any of it had even been worked.
const lastCompletedMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
};
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
let labourProviderPayablesCache = null;

const TABS = [
    { key: 'vendor',           label: 'Vendor' },
    { key: 'contractor',       label: 'Contractor' },
    { key: 'salary',           label: 'Salary' },
    { key: 'commission',       label: 'Commission' },
    { key: 'labourProvider',   label: 'Labour Provider' },
    { key: 'deductions',       label: 'Deductions' },
    { key: 'client-direct-payments', label: 'Client Direct Payments' },
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
    const aliveRef = useRef(true);
    useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

    const fetchRows = async () => {
        try {
            const vendorsRes = await axios.get(`${url}/api/finance/vendors/list`, authHeader);
            const contractors = vendorsRes.data.success ? vendorsRes.data.data.filter(v => v.vendorType === 'labour_contractor') : [];
            const ledgers = await Promise.all(contractors.map(v =>
                axios.get(`${url}/api/finance/contractors/${v._id}/ledger`, authHeader)
                    .then(res => (res.data.success ? { vendorId: v._id, vendorName: v.name, ...res.data.data.totals } : null))
                    .catch(() => null)
            ));
            if (aliveRef.current) {
                const next = ledgers.filter(Boolean).sort((a, b) => b.balancePayable - a.balancePayable);
                setRows(next);
                contractorPayablesCache = next;
            }
        } catch {
            if (aliveRef.current) toast.error('Error fetching contractor payables');
        } finally {
            if (aliveRef.current) setLoading(false);
        }
    };

    useEffect(() => { fetchRows(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // Contractor balance payable is built from work assignments, measured
    // area, contractor rates, and the advance/deduction/payment ledger —
    // any of those changing (from this tab or elsewhere) should update the
    // balance without waiting for a revisit.
    useFinanceWsRefresh([
        'financeVendorsChanged', 'financeWorksChanged', 'financeMeasurementsChanged',
        'financeContractorRatesChanged', 'financeWorkContractorAssignmentsChanged', 'financeContractorLedgerChanged',
    ], fetchRows);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (rows.length === 0) return <div className="admin-empty-state"><p>No labour contractors yet.</p></div>;

    return (
        <div className="list-table finance-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr' }}>
                <b>Contractor</b><b>Total</b><b>Approved</b><b>Unapproved</b><b>Advances</b><b>Deductions</b><b>Payments</b><b>Balance Payable</b>
            </div>
            {rows.map(r => (
                <div key={r.vendorId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr' }}>
                    <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate('/finance/contractors')}>{r.vendorName}</p>
                    <p>₹{r.totalAmount.toLocaleString('en-IN')}</p>
                    <p style={{ color: r.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}>{r.earnings > 0 ? `₹${r.earnings.toLocaleString('en-IN')}` : 'Unapproved'}</p>
                    <p style={{ color: r.unapprovedAmount > 0 ? '#c0392b' : 'var(--text-lt)' }}>₹{r.unapprovedAmount.toLocaleString('en-IN')}</p>
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
    const aliveRef = useRef(true);
    useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

    const fetchRows = async () => {
        try {
            const vendorsRes = await axios.get(`${url}/api/finance/vendors/list`, authHeader);
            const nonContractors = vendorsRes.data.success ? vendorsRes.data.data.filter(v => v.vendorType !== 'labour_contractor') : [];
            const ledgers = await Promise.all(nonContractors.map(v =>
                axios.get(`${url}/api/finance/vendors/${v._id}/ledger`, authHeader)
                    .then(res => (res.data.success ? { vendorId: v._id, vendorName: v.name, ...res.data.data.totals } : null))
                    .catch(() => null)
            ));
            if (aliveRef.current) {
                const next = ledgers.filter(Boolean).sort((a, b) => b.amountOwed - a.amountOwed);
                setRows(next);
                vendorPayablesCache = next;
            }
        } catch {
            if (aliveRef.current) toast.error('Error fetching vendor payables');
        } finally {
            if (aliveRef.current) setLoading(false);
        }
    };

    useEffect(() => { fetchRows(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh(['financeVendorsChanged', 'financePurchasesChanged', 'financeVendorLedgerChanged'], fetchRows);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (rows.length === 0) return <div className="admin-empty-state"><p>No vendors yet.</p></div>;

    return (
        <div className="list-table finance-table">
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

/* Balance due per employee for the last fully completed month, pulled
   from the salary ledger endpoint — same N+1 pattern as the tabs above.
   Never the current, still-in-progress month (see lastCompletedMonth);
   switch employees' own Salary Ledger (under Masters) for history across
   other months. */
const PayablesSalaryTab = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const month = lastCompletedMonth();
    // Cached per month, not just once — "For June" and "For July" are
    // genuinely different data, so a cache hit only counts if it's for
    // the same month this render is asking about.
    const cacheHit = salaryPayablesCache?.month === month ? salaryPayablesCache.rows : null;
    const [rows, setRows] = useState(cacheHit || []);
    const [loading, setLoading] = useState(!cacheHit);
    const aliveRef = useRef(true);
    useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

    const fetchRows = async () => {
        try {
            const employeesRes = await axios.get(`${url}/api/finance/employees/list`, authHeader);
            const employees = employeesRes.data.success ? employeesRes.data.data : [];
            const ledgers = await Promise.all(employees.map(e =>
                axios.get(`${url}/api/finance/employees/${e._id}/salary-ledger`, { ...authHeader, params: { month } })
                    .then(res => (res.data.success ? res.data.data : null))
                    .catch(() => null)
            ));
            if (aliveRef.current) {
                const next = ledgers.filter(Boolean).sort((a, b) => b.balanceDue - a.balanceDue);
                setRows(next);
                salaryPayablesCache = { month, rows: next };
            }
        } catch {
            if (aliveRef.current) toast.error('Error fetching salary payables');
        } finally {
            if (aliveRef.current) setLoading(false);
        }
    };

    useEffect(() => { fetchRows(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh(['financeEmployeesChanged', 'financeSalaryPaymentsChanged'], fetchRows);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (rows.length === 0) return <div className="admin-empty-state"><p>No employees yet.</p></div>;

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>For {month}</p>
            <div className="list-table finance-table">
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

/* Commission payable per referral, pulled from the commission ledger
   endpoint — same N+1 pattern as the tabs above. A referral is its own
   collection (financeReferral), not a vendor. */
const PayablesCommissionTab = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [rows, setRows] = useState(commissionPayablesCache || []);
    const [loading, setLoading] = useState(!commissionPayablesCache);
    const aliveRef = useRef(true);
    useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

    const fetchRows = async () => {
        try {
            const referralsRes = await axios.get(`${url}/api/finance/referrals/list`, authHeader);
            const referrals = referralsRes.data.success ? referralsRes.data.data : [];
            const ledgers = await Promise.all(referrals.map(r =>
                axios.get(`${url}/api/finance/referrals/${r._id}/commission-ledger`, authHeader)
                    .then(res => (res.data.success ? { referralId: r._id, referralName: r.name, ...res.data.data.totals } : null))
                    .catch(() => null)
            ));
            if (aliveRef.current) {
                const next = ledgers.filter(Boolean).sort((a, b) => b.commissionPayable - a.commissionPayable);
                setRows(next);
                commissionPayablesCache = next;
            }
        } catch {
            if (aliveRef.current) toast.error('Error fetching commission payables');
        } finally {
            if (aliveRef.current) setLoading(false);
        }
    };

    useEffect(() => { fetchRows(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh(['financeReferralsChanged', 'financeProjectsChanged', 'financeWorksChanged', 'financeWorkTypeRatesChanged', 'financeCommissionPaymentsChanged'], fetchRows);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (rows.length === 0) return <div className="admin-empty-state"><p>No referrals yet.</p></div>;

    return (
        <div className="list-table finance-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1.2fr 0.9fr 0.9fr 0.9fr 1fr' }}>
                <b>Referral</b><b>Approved</b><b>Unapproved</b><b>Payments</b><b>Commission Payable</b>
            </div>
            {rows.map(r => (
                <div key={r.referralId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.2fr 0.9fr 0.9fr 0.9fr 1fr' }}>
                    <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate('/finance/procurement')}>{r.referralName}</p>
                    <p style={{ color: r.earnings > 0 ? 'var(--moss)' : 'var(--text-lt)', fontWeight: 600 }}>{r.earnings > 0 ? `₹${r.earnings.toLocaleString('en-IN')}` : 'Unapproved'}</p>
                    <p style={{ color: r.unapprovedAmount > 0 ? '#c0392b' : 'var(--text-lt)' }}>₹{r.unapprovedAmount.toLocaleString('en-IN')}</p>
                    <p>₹{r.payments.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 600, color: r.commissionPayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{r.commissionPayable.toLocaleString('en-IN')}</p>
                </div>
            ))}
        </div>
    );
};

/* Balance payable per labour provider, pulled from the labour provider
   ledger endpoint — same N+1 pattern as the tabs above. "Payable" here is
   totals.balancePayable (approvedPay − paymentsTotal), the same figure
   surfaced as "Total Pay Left" in LabourProviderLedgerView. A labour
   provider is its own collection (financeLabourProvider), not a vendor. */
const PayablesLabourProviderTab = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [rows, setRows] = useState(labourProviderPayablesCache || []);
    const [loading, setLoading] = useState(!labourProviderPayablesCache);
    const aliveRef = useRef(true);
    useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

    const fetchRows = async () => {
        try {
            const providersRes = await axios.get(`${url}/api/finance/labour-providers/list`, authHeader);
            const providers = providersRes.data.success ? providersRes.data.data : [];
            const ledgers = await Promise.all(providers.map(v =>
                axios.get(`${url}/api/finance/labour-providers/${v._id}/labour-provider-ledger`, authHeader)
                    .then(res => (res.data.success ? { labourProviderId: v._id, labourProviderName: v.name, ...res.data.data.totals } : null))
                    .catch(() => null)
            ));
            if (aliveRef.current) {
                const next = ledgers.filter(Boolean).sort((a, b) => b.balancePayable - a.balancePayable);
                setRows(next);
                labourProviderPayablesCache = next;
            }
        } catch {
            if (aliveRef.current) toast.error('Error fetching labour provider payables');
        } finally {
            if (aliveRef.current) setLoading(false);
        }
    };

    useEffect(() => { fetchRows(); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh(['financeLabourProvidersChanged', 'financeLabourersChanged', 'financeWorksChanged', 'financeWorkReviewChanged', 'financeLabourProviderPaymentsChanged'], fetchRows);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (rows.length === 0) return <div className="admin-empty-state"><p>No labour providers yet.</p></div>;

    return (
        <div className="list-table finance-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1.2fr 0.9fr 0.9fr 0.9fr 1fr' }}>
                <b>Labour Provider</b><b>Approved Pay</b><b>Pay Left to Approve</b><b>Payments</b><b>Balance Payable</b>
            </div>
            {rows.map(r => (
                <div key={r.labourProviderId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.2fr 0.9fr 0.9fr 0.9fr 1fr' }}>
                    <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate('/finance/daily-labour')}>{r.labourProviderName}</p>
                    <p>₹{r.approvedPay.toLocaleString('en-IN')}</p>
                    <p style={{ color: r.pendingApprovalPay > 0 ? '#c0392b' : 'var(--text-lt)' }}>₹{r.pendingApprovalPay.toLocaleString('en-IN')}</p>
                    <p>₹{r.paymentsTotal.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 600, color: r.balancePayable > 0 ? '#c0392b' : 'var(--moss)' }}>₹{r.balancePayable.toLocaleString('en-IN')}</p>
                </div>
            ))}
        </div>
    );
};

const PayablesPage = ({ url }) => {
    const [searchParams] = useSearchParams();
    // Supports deep-linking in from a project's own Expenses tab's
    // "Details" action: ?tab=expenses opens straight to the full log, and
    // ?expenseId= scrolls to + briefly highlights that one row. ?status=
    // (from the Dashboard's Expense Payables KPI) pre-selects that status
    // filter instead of landing on the full unfiltered list.
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
            subtitle="Computed from vendor balance + contractor balance + unpaid salary + unpaid commission: never a directly-writable record. Expenses/Expense Analysis/Company Expenses/Other Expenses are reads of the expense log instead, not a ledger."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'vendor' && <PayablesVendorTab url={url} />}
            {activeTab === 'contractor' && <PayablesContractorTab url={url} />}
            {activeTab === 'salary' && <PayablesSalaryTab url={url} />}
            {activeTab === 'commission' && <PayablesCommissionTab url={url} />}
            {activeTab === 'labourProvider' && <PayablesLabourProviderTab url={url} />}
            {activeTab === 'deductions' && <WorkDeductionAllocationPanel url={url} />}
            {activeTab === 'client-direct-payments' && <ClientDirectPaymentsManager url={url} />}
            {activeTab === 'expenses' && <ExpensesManager url={url} highlightId={searchParams.get('expenseId')} defaultStatusFilter={searchParams.get('status')} />}
            {activeTab === 'expense-analysis' && <ExpenseAnalysisView url={url} />}
            {activeTab === 'company' && companyId && (
                <ExpensesManager url={url} fixedRelatedTo={{ type: 'financeCompanySettings', id: companyId, label: `${companyName} Expenses` }} />
            )}
            {activeTab === 'other' && <ExpensesManager url={url} fixedCategory={OTHER_CATEGORY} />}
        </FinanceTabShell>
    );
};

export default PayablesPage;
