import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import RouteLoader from '../../components/RouteLoader';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faPen, faTrash, faCheck } from '@fortawesome/free-solid-svg-icons';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import DocumentsTab from '../../components/finance/DocumentsTab';
import { useFileDownload } from '../../hooks/useFileDownload';
import DownloadButton from '../../components/finance/DownloadButton';
import { KpiCard, KpiGrid, ChartCard, ChartGrid, EmptyChart, ChartTooltip, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
import ViewAttachmentLink from '../../components/finance/ViewAttachmentLink';
import '../../styles/list.css';
import '../../styles/dashboard.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const AGE_BUCKETS = ['0-30', '30-60', '60-90', '90+'];

/*
 * Tier-2 KPIs + aging for this client — new /client-detail endpoint, sits
 * above the existing Details fields. Projects/Receipts/Bills/Payments/
 * Ledger tabs are untouched.
 */
const ClientDashboardSummary = ({ url, clientId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [detail, setDetail] = useState(null);

    useEffect(() => {
        axios.get(`${url}/api/finance/reports/client-detail`, { ...authHeader, params: { clientId } })
            .then(res => { if (res.data.success) setDetail(res.data.data); })
            .catch(() => {});
    }, [url, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!detail) return null;
    const agingData = AGE_BUCKETS.map(bucket => ({ bucket, amount: detail.aging[bucket] }));

    return (
        <div style={{ marginBottom: '24px' }}>
            <KpiGrid>
                <KpiCard label="Total Billed" value={formatINR(detail.totalBilled)}
                    sub={detail.billCount > 0 ? `From ${detail.billCount} bill${detail.billCount === 1 ? '' : 's'} issued` : undefined} />
                <KpiCard label="Total Received" value={formatINR(detail.totalReceived)}
                    // detail.outstanding (not totalBilled - totalReceived,
                    // which ignores direct payments the client made straight
                    // to a contractor/labourer) — the exact figure the
                    // "Outstanding" card right next to this one already
                    // shows, so the two can never contradict each other.
                    sub={detail.outstanding > 0 ? `${formatINR(detail.outstanding)} still outstanding` : undefined} />
                <KpiCard label="Outstanding" value={formatINR(detail.outstanding)} tone={detail.outstanding > 0 ? 'danger' : 'good'} />
                <KpiCard label="Margin %" value={`${Math.round((detail.marginPercent || 0) * 10) / 10}%`} tone={detail.marginPercent >= 0 ? 'good' : 'danger'}
                    sub={`Profit ${formatINR(detail.totalProfit)} on Revenue ${formatINR(detail.totalBilled)}`} />
                {detail.clientCreditBalance > 0 && (
                    <KpiCard label="Client Credit Balance" value={formatINR(detail.clientCreditBalance)} tone="good"
                        sub="Direct payments ahead of what's been billed — applied automatically to future bills" />
                )}
            </KpiGrid>
            <ChartGrid>
                <ChartCard title="Receivables Aging">
                    {agingData.some(a => a.amount > 0) ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={agingData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                <Bar dataKey="amount" name="Outstanding" radius={[4, 4, 0, 0]} activeBar={false}>
                                    {agingData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart text="Nothing outstanding right now." />}
                </ChartCard>
            </ChartGrid>
        </div>
    );
};

const TABS = [
    { key: 'details',   label: 'Client Details' },
    { key: 'projects',  label: 'Projects' },
    { key: 'quotations', label: 'Quotations' },
    { key: 'receipts',  label: 'Receipts' },
    { key: 'bills',     label: 'Bills' },
    { key: 'documents', label: 'Documents' },
    { key: 'contacts',  label: 'Contact Persons' },
    { key: 'payments',  label: 'Payment History' },
    { key: 'ledger',    label: 'Ledger' },
];

const CONTRACT_TYPE_LABEL = { with_material: 'With Material', without_material: 'Without Material', advance: 'Advance' };
const STATUS_LABEL = { draft: 'Draft', active: 'Active', completed: 'Completed' };
const BILL_STATUS_LABEL = { draft: 'Draft', issued: 'Issued' };

// There is no GET /api/finance/clients/:id endpoint — the client and its
// projects are both found by filtering the existing /list responses
// client-side, same as the "REAL-ish" pattern used elsewhere in this
// restructure.
const useClientProjectCount = (url, clientId) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [count, setCount] = useState(null);

    useEffect(() => {
        let cancelled = false;
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(res => {
                if (res.data.success && !cancelled) {
                    setCount(res.data.data.filter(p => (p.clientId?._id || p.clientId) === clientId).length);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [url, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    return count;
};

// Work types per project come from the same /api/finance/work-type-rates/list
// endpoint ProjectDetail's Works tab already uses — one call per matched
// project. Only fetched when this tab is actually opened, not on every visit
// to the client, since it's an N+1 fan-out.
const ClientProjectsTab = ({ url, clientId }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        axios.get(`${url}/api/finance/projects/list`, authHeader)
            .then(async (res) => {
                if (!res.data.success) return;
                const clientProjects = res.data.data.filter(p => (p.clientId?._id || p.clientId) === clientId);
                const withWorkTypes = await Promise.all(clientProjects.map(async (p) => {
                    try {
                        const rateRes = await axios.get(`${url}/api/finance/work-type-rates/list`, { ...authHeader, params: { projectId: p._id } });
                        return { ...p, workTypes: rateRes.data.success ? rateRes.data.data.map(r => r.workType) : [] };
                    } catch {
                        return { ...p, workTypes: [] };
                    }
                }));
                if (!cancelled) setProjects(withWorkTypes);
            })
            .catch(() => toast.error('Error fetching projects'))
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [url, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (projects.length === 0) return <div className="admin-empty-state"><p>No projects for this client yet.</p></div>;

    return (
        // Same dash-chart-card/row-with-named-grid-areas shape as All
        // Projects' own Project Directory (ProjectsList.jsx) — reuses its
        // .pl-name/.pl-contract/.pl-status/.pl-readiness/.pl-actions cells
        // and mobile reflow verbatim; Client here is dropped (redundant —
        // already scoped to this one client) and replaced with Work Types
        // (.pl-worktypes, .client-projects-row in dashboard.css), which is
        // what this tab already computed but had nowhere polished to show.
        <div className="dash-chart-card projects-list-card">
            <p className="dash-chart-title">{projects.length} Project{projects.length === 1 ? '' : 's'} Given to Us</p>
            <div className="client-projects-row projects-list-header">
                <b className="pl-name">Name</b>
                <b className="pl-worktypes">Work Types</b>
                <b className="pl-contract">Contract Type</b>
                <b className="pl-status">Status</b>
                <b className="pl-readiness">Readiness</b>
                <b className="pl-actions">Action</b>
            </div>
            {projects.map(p => (
                <div key={p._id} className="client-projects-row">
                    <p className="pl-name" onClick={() => navigate(`/finance/projects/${p._id}`)}>{p.name}</p>
                    <p className="pl-worktypes">{p.workTypes.length > 0 ? p.workTypes.join(', ') : '-'}</p>
                    <span className="item-category pl-contract">{CONTRACT_TYPE_LABEL[p.contractType]}</span>
                    <span className="item-category pl-status">{STATUS_LABEL[p.status]}</span>
                    <span
                        className={`pl-readiness ${p.readiness?.ready ? 'is-ready' : 'is-missing'}`}
                        title={p.readiness?.ready ? undefined : p.readiness?.missing?.join(', ')}
                    >
                        {p.readiness?.ready ? '✓ Ready' : `⚠ Missing ${p.readiness?.missing?.length}`}
                    </span>
                    <div className="action-buttons pl-actions">
                        <p onClick={() => navigate(`/finance/projects/${p._id}`)} className="cursor edit-action">View</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

/*
 * Bills, Payment History, Ledger, and Quotations all come from the same
 * sources — this client's running bills and quotations (each fetched
 * per-project, since both endpoints only filter by projectId — quotations
 * are owned by a Project, not a Client, since the studio always creates
 * the Project before quoting) and their receipts (which the receipts
 * endpoint filters by clientId directly). Fetched once, shared across the
 * four tabs, rather than four separate N+1 fan-outs.
 */
const useClientBillsAndReceipts = (url, clientId) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [bills, setBills] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const [projectsRes, receiptsRes] = await Promise.all([
                    axios.get(`${url}/api/finance/projects/list`, authHeader),
                    axios.get(`${url}/api/finance/receipts/list`, { ...authHeader, params: { clientId } }),
                ]);
                const clientProjects = projectsRes.data.success
                    ? projectsRes.data.data.filter(p => (p.clientId?._id || p.clientId) === clientId)
                    : [];
                const [billLists, quotationLists] = await Promise.all([
                    Promise.all(clientProjects.map(p =>
                        axios.get(`${url}/api/finance/running-bills/list`, { ...authHeader, params: { projectId: p._id } })
                            .then(res => (res.data.success ? res.data.data.map(b => ({ ...b, projectName: p.name })) : []))
                            .catch(() => [])
                    )),
                    Promise.all(clientProjects.map(p =>
                        axios.get(`${url}/api/finance/client-quotations/list`, { ...authHeader, params: { projectId: p._id } })
                            .then(res => (res.data.success ? res.data.data.map(q => ({ ...q, projectName: p.name })) : []))
                            .catch(() => [])
                    )),
                ]);
                if (!cancelled) {
                    setBills(billLists.flat());
                    setQuotations(quotationLists.flat());
                    setReceipts(receiptsRes.data.success ? receiptsRes.data.data : []);
                }
            } catch {
                if (!cancelled) toast.error('Error fetching bills and receipts');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    return { bills, quotations, receipts, loading };
};

const ClientBillsTab = ({ url, clientId }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const { bills, loading } = useClientBillsAndReceipts(url, clientId);
    const { progress, run: runDownload } = useFileDownload(authHeader);
    const [downloadingKey, setDownloadingKey] = useState(null); // `${billId}:${mode}`

    // Protected download — a plain <a href> can't carry the Bearer token,
    // so this fetches the PDF as a blob (see useFileDownload) with a real,
    // live byte/percent readout while the transfer is in progress. Same
    // pattern as RunningBillsManager's own "Statement" action.
    // mode: 'color' (default) or 'bw' — same route, just ?mode=bw for a
    // grayscale statement meant for printing.
    const downloadStatement = async (b, mode = 'color') => {
        setDownloadingKey(`${b._id}:${mode}`);
        const suffix = mode === 'bw' ? '-BW' : '';
        await runDownload(
            url, `/api/finance/running-bills/${b._id}/statement/download`,
            `Bill-Statement-${b.billNumber}${suffix}.pdf`,
            mode === 'bw' ? { mode: 'bw' } : {},
            'Error downloading statement'
        );
        setDownloadingKey(null);
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (bills.length === 0) return <div className="admin-empty-state"><p>No bills raised for this client yet.</p></div>;

    return (
        // Same dash-chart-card row shape as this client's own Projects/
        // Quotations/Receipts tabs — Project takes the place Running Bills'
        // own table (Project Detail's Bills tab) never needed, since that
        // one is already scoped to a single project.
        <div className="dash-chart-card client-bills-card">
            <p className="dash-chart-title">Bills Across All Projects</p>
            <div className="client-bills-row cb-header">
                <b className="cb-project">Project</b>
                <b className="cb-num">Bill #</b>
                <b className="cb-date">Date</b>
                <b className="cb-total">Total</b>
                <b className="cb-status">Status</b>
                <b className="cb-actions">Action</b>
            </div>
            {bills.map(b => (
                <div key={b._id} className="client-bills-row">
                    <p className="cb-project" onClick={() => navigate(`/finance/projects/${b.projectId}`)}>{b.projectName}</p>
                    <p className="cb-num">#{b.billNumber}</p>
                    <p className="cb-date">{new Date(b.billDate).toLocaleDateString()}</p>
                    <p className="cb-total">₹{(b.totalAmount + (b.gstAmount || 0)).toLocaleString('en-IN')}</p>
                    <p className="cb-status">
                        <span className={`item-category ${b.status === 'issued' ? 'cb-pill-issued' : 'cb-pill-draft'}`}>{BILL_STATUS_LABEL[b.status]}</span>
                    </p>
                    <div className="action-buttons cb-actions">
                        <DownloadButton
                            as="p" downloading={downloadingKey === `${b._id}:color`} progress={downloadingKey === `${b._id}:color` ? progress : null}
                            idleLabel="Statement" onClick={() => downloadStatement(b, 'color')} className="cursor edit-action"
                        />
                        <DownloadButton
                            as="p" downloading={downloadingKey === `${b._id}:bw`} progress={downloadingKey === `${b._id}:bw` ? progress : null}
                            idleLabel="B&W" onClick={() => downloadStatement(b, 'bw')} className="cursor edit-action"
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

// Same dash-chart-card row shape as this client's own Projects/Quotations
// tabs, and the same column set as ReceiptsManager's own table (Project
// Detail's Receipts tab) minus its delete action — read-only here, same
// reasoning as Quotations: a receipt can only be recorded or removed from
// within a project's own Receipts tab. Bill/Account are new (only Date/
// Amount/Mode/Reference showed before); the data was already available
// from the same /receipts/list response, just not surfaced.
const ClientReceiptsTab = ({ url, clientId }) => {
    const { receipts, loading } = useClientBillsAndReceipts(url, clientId);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (receipts.length === 0) return <div className="admin-empty-state"><p>No receipts recorded for this client yet.</p></div>;

    return (
        <div className="dash-chart-card client-receipts-card">
            <p className="dash-chart-title">Receipts Across All Projects</p>
            <div className="client-receipts-row cr-header">
                <b className="cr-date">Date</b>
                <b className="cr-amount">Amount</b>
                <b className="cr-bill">Bill</b>
                <b className="cr-mode">Mode</b>
                <b className="cr-account">Account</b>
                <b className="cr-reference">Reference</b>
            </div>
            {receipts.map(r => (
                <div key={r._id} className="client-receipts-row">
                    <p className="cr-date"><span className="cr-field-label">Date</span>{new Date(r.receiptDate).toLocaleDateString()}</p>
                    <p className="cr-amount"><span className="cr-field-label">Amount</span>₹{r.amount.toLocaleString('en-IN')}</p>
                    <p className="cr-bill"><span className="cr-field-label">Bill</span>{r.runningBillId?.billNumber ? `#${r.runningBillId.billNumber}` : '-'}</p>
                    <p className="cr-mode"><span className="cr-field-label">Mode</span>{r.paymentMode || '-'}</p>
                    <p className="cr-account"><span className="cr-field-label">Account</span>{r.bankAccountId?.accountName || (r.paymentMode ? 'Cash' : '-')}</p>
                    <p className="cr-reference"><span className="cr-field-label">Reference</span>{r.utrNumber || r.bankOrCashLabel || '-'}</p>
                </div>
            ))}
        </div>
    );
};

// A merged timeline of issued bills (debits) and receipts (credits) — draft
// bills aren't a financial event yet, so they're excluded here even though
// they show on the Bills tab.
const useMergedFeed = (url, clientId) => {
    const { bills, receipts, loading } = useClientBillsAndReceipts(url, clientId);
    const feed = [
        ...bills.filter(b => b.status === 'issued').map(b => ({ type: 'bill', date: b.billDate, amount: b.totalAmount + (b.gstAmount || 0), label: `Bill #${b.billNumber} issued · ${b.projectName}` })),
        ...receipts.map(r => ({ type: 'receipt', date: r.receiptDate, amount: r.amount, label: `Receipt received${r.paymentMode ? ` (${r.paymentMode})` : ''}` })),
    ];
    return { feed, loading };
};

// Same dash-chart-card row shape as Bills/Quotations above — this feed is
// read-only (merged from issued bills + receipts, see useMergedFeed) so
// there's no Actions column at all, just Date/Event/Amount.
const ClientPaymentHistoryTab = ({ url, clientId }) => {
    const { feed, loading } = useMergedFeed(url, clientId);
    const sorted = [...feed].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (sorted.length === 0) return <div className="admin-empty-state"><p>No billing activity for this client yet.</p></div>;

    return (
        <div className="dash-chart-card client-payments-card">
            <p className="dash-chart-title">Payment History Across All Projects</p>
            <div className="client-payments-row cph-header">
                <b className="cph-date">Date</b>
                <b className="cph-event">Event</b>
                <b className="cph-amount">Amount</b>
            </div>
            {sorted.map((e, i) => (
                <div key={i} className="client-payments-row">
                    <p className="cph-date">{new Date(e.date).toLocaleDateString()}</p>
                    <p className="cph-event">{e.label}</p>
                    <p className={`cph-amount ${e.type === 'bill' ? 'cph-amount-debit' : 'cph-amount-credit'}`}>{e.type === 'bill' ? '+' : '−'}₹{e.amount.toLocaleString('en-IN')}</p>
                </div>
            ))}
        </div>
    );
};

const ClientLedgerTab = ({ url, clientId }) => {
    const { feed, loading } = useMergedFeed(url, clientId);
    const sorted = [...feed].sort((a, b) => new Date(a.date) - new Date(b.date));
    let running = 0;
    const withBalance = sorted.map(e => {
        running += e.type === 'bill' ? e.amount : -e.amount;
        return { ...e, balance: running };
    });

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (withBalance.length === 0) return <div className="admin-empty-state"><p>No billing activity for this client yet.</p></div>;

    return (
        <div className="dash-chart-card client-ledger-card">
            <p className="dash-chart-title">Running Ledger Across All Projects</p>
            <div className="client-ledger-row ledg-header">
                <b className="ledg-date">Date</b>
                <b className="ledg-event">Event</b>
                <b className="ledg-amount">Amount</b>
                <b className="ledg-balance">Balance</b>
            </div>
            {withBalance.map((e, i) => (
                <div key={i} className="client-ledger-row">
                    <p className="ledg-date">{new Date(e.date).toLocaleDateString()}</p>
                    <p className="ledg-event">{e.label}</p>
                    <p className={`ledg-amount ${e.type === 'bill' ? 'cph-amount-debit' : 'cph-amount-credit'}`}>{e.type === 'bill' ? '+' : '−'}₹{e.amount.toLocaleString('en-IN')}</p>
                    <p className="ledg-balance">₹{e.balance.toLocaleString('en-IN')}</p>
                </div>
            ))}
        </div>
    );
};

const QUOTATION_STATUS_LABEL = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' };
const QUOTATION_STATUS_PILL_CLASS = { pending: 'pq-pill-pending', accepted: 'pq-pill-accepted', rejected: 'pq-pill-rejected' };

// Read-only rollup across this client's projects — quotations are owned by
// a Project (see ProjectQuotationsManager, on the Project Detail page's
// own Quotations tab), which is where they're added and have their status
// changed. This tab exists so you don't have to open each project
// separately just to see what's been quoted to this client overall.
//
// Same dash-chart-card/.pq-* cell shape as ProjectQuotationsManager's own
// table — reuses .pq-num/.pq-date/.pq-amount/.pq-status/.pq-file and the
// colored status pills verbatim. That table's Actions column (Accept/
// Reject/Upload/Delete) has no place here — this view is read-only by
// design — so Project takes its place instead (.pq-project,
// .client-quotations-row in dashboard.css), the one column this rollup
// needs that a single-project view never would.
const ClientQuotationsTab = ({ url, clientId }) => {
    const navigate = useNavigate();
    const { quotations, loading } = useClientBillsAndReceipts(url, clientId);
    const sorted = [...quotations].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (sorted.length === 0) return <div className="admin-empty-state"><p>No quotations issued to this client yet.</p></div>;

    return (
        <div className="dash-chart-card pq-card">
            <p className="dash-chart-title">Quotations Across All Projects</p>
            <div className="client-quotations-row pq-header">
                <b className="pq-project">Project</b>
                <b className="pq-num">#</b>
                <b className="pq-date">Date</b>
                <b className="pq-amount">Amount</b>
                <b className="pq-status">Status</b>
                <b className="pq-file">File</b>
            </div>
            {sorted.map(q => (
                <div key={q._id} className="client-quotations-row">
                    <p className="pq-project" onClick={() => navigate(`/finance/projects/${q.projectId}`)}>{q.projectName}</p>
                    <p className="pq-num">#{q.quotationNumber}</p>
                    <p className="pq-date">{new Date(q.date).toLocaleDateString()}</p>
                    <p className="pq-amount">₹{q.amount.toLocaleString('en-IN')}</p>
                    <p className="pq-status">
                        <span className={`item-category ${QUOTATION_STATUS_PILL_CLASS[q.status]}`}>{QUOTATION_STATUS_LABEL[q.status]}</span>
                    </p>
                    <div className="pq-file">
                        <span className="pq-group-label">File</span>
                        {q.documents?.[0]
                            ? <ViewAttachmentLink url={q.documents[0].fileUrl} name={q.documents[0].name} className="cursor edit-action" style={{ textDecoration: 'none' }}>View</ViewAttachmentLink>
                            : <p style={{ margin: 0 }}>-</p>}
                    </div>
                </div>
            ))}
        </div>
    );
};

const emptyContactForm = { name: '', designation: '', phone: '', email: '', notes: '' };

const getInitials = (name = '') =>
    name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

// Same dash-chart-card/avatar row shape as Clients page's own Client
// Directory (ClientsPage.jsx via MasterCrudTable) — this is genuinely the
// same kind of data (a directory of people), so it gets the same visual
// language: initial avatars, icon+text actions. The Add/Edit modal is
// upgraded to the same bottom-sheet shape (cp-overlay/cp-modal) every
// other dialog in the app already uses; delete now confirms first
// (bin-confirm-modal, same as every other destructive action in this app)
// instead of firing immediately on click, which is what every other
// "remove" action here already does — this one just hadn't caught up yet.
const ClientContactsTab = ({ url, clientId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyContactForm);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchList = () => {
        setLoading(true);
        axios.get(`${url}/api/finance/client-contacts/list`, { ...authHeader, params: { clientId } })
            .then(res => { if (res.data.success) setContacts(res.data.data); })
            .catch(() => toast.error('Error fetching contacts'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchList(); }, [url, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const openAdd = () => { setEditingId(null); setForm(emptyContactForm); setModalOpen(true); };

    const openEdit = (c) => {
        setEditingId(c._id);
        setForm({ name: c.name, designation: c.designation || '', phone: c.phone || '', email: c.email || '', notes: c.notes || '' });
        setModalOpen(true);
    };

    const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(emptyContactForm); };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error('Name is required');
        setSaving(true);
        try {
            const payload = editingId ? { _id: editingId, ...form } : { clientId, ...form };
            const endpoint = editingId ? 'update' : 'add';
            const res = await axios.post(`${url}/api/finance/client-contacts/${endpoint}`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Saved');
                closeModal();
                fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving contact');
        } finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.post(`${url}/api/finance/client-contacts/remove`, { _id: confirmItem._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing contact'); }
        finally { setDeleting(false); }
    };

    return (
        <div>
            <div className="pq-section-header">
                <h3 style={{ margin: 0 }}>Contacts</h3>
                <button type="button" className="add-btn" onClick={openAdd}>+ Add Contact</button>
            </div>

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : contacts.length === 0 ? (
                <div className="admin-empty-state"><p>No additional contact persons for this client yet.</p></div>
            ) : (
                <div className="dash-chart-card client-contacts-card">
                    <div className="client-contacts-row cc-header">
                        <b className="cc-name">Name</b>
                        <b className="cc-designation">Designation</b>
                        <b className="cc-phone">Phone</b>
                        <b className="cc-email">Email</b>
                        <b className="cc-actions">Action</b>
                    </div>
                    {contacts.map(c => (
                        <div key={c._id} className="client-contacts-row">
                            <div className="cc-name">
                                <span className="client-avatar"><span className="client-avatar-initials">{getInitials(c.name)}</span></span>
                                {c.name}
                            </div>
                            <p className="cc-designation"><span className="pq-group-label">Designation</span>{c.designation || '-'}</p>
                            <p className="cc-phone"><span className="pq-group-label">Phone</span>{c.phone || '-'}</p>
                            <p className="cc-email"><span className="pq-group-label">Email</span>{c.email || '-'}</p>
                            <div className="action-buttons cc-actions">
                                <p onClick={() => openEdit(c)} className="cursor edit-action">
                                    <FontAwesomeIcon icon={faPen} className="pq-action-icon mastercrud-action-icon" />
                                    <span className="mastercrud-action-text">Edit</span>
                                </p>
                                <button type="button" onClick={() => setConfirmItem(c)} className="pq-btn-ghost-danger" title="Remove contact" aria-label="Remove contact">
                                    <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay cp-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal cp-modal">
                        <div className="cp-modal-header">
                            <h2>{editingId ? 'Edit Contact' : 'Add Contact'}</h2>
                        </div>
                        <div className="cp-modal-body">
                            <form id="client-contact-form" onSubmit={submit}>
                                <div className="wizard-field-grid">
                                    <div className="add-product-name flex-col">
                                        <p>Name<span className="wizard-required-mark"> *</span></p>
                                        <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Designation</p>
                                        <input type="text" value={form.designation} onChange={e => setField('designation', e.target.value)} placeholder="e.g. Site Engineer" />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Phone</p>
                                        <input type="text" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="10-digit mobile number" />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Email</p>
                                        <input type="text" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="name@example.com" />
                                    </div>
                                    <div className="add-product-name flex-col wizard-field-full">
                                        <p>Notes</p>
                                        <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Optional" />
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="edit-modal-actions cp-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                            <button type="submit" form="client-contact-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : <><FontAwesomeIcon icon={faCheck} className="pq-action-icon" /> Save</>}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove Contact?</h3>
                        <p className="bin-confirm-name">{confirmItem.name}</p>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

const ClientDetail = ({ url }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [activeTab, setActiveTab] = useState('details');
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);
    const projectCount = useClientProjectCount(url, id);

    useEffect(() => {
        setLoading(true);
        axios.get(`${url}/api/finance/clients/list`, authHeader)
            .then(res => {
                if (res.data.success) setClient(res.data.data.find(c => c._id === id) || null);
                else toast.error(res.data.message);
            })
            .catch(() => toast.error('Error fetching client'))
            .finally(() => setLoading(false));
    }, [url, id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return <RouteLoader />;
    }
    if (!client) {
        return <div className="list add flex-col"><div className="admin-list-container"><div className="admin-empty-state"><p>Client not found.</p></div></div></div>;
    }

    const backLink = (
        <button type="button" className="admin-search-clear" style={{ position: 'static', fontSize: '0.8rem', color: 'var(--text-lt)', marginBottom: '8px' }} onClick={() => navigate('/finance/clients')}>← All Clients</button>
    );

    return (
        <FinanceTabShell
            label={client.name}
            subtitle={client.phone || client.email || undefined}
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
            backLink={backLink}
        >
            {activeTab === 'details' && (
                <div>
                    {/* Same shape as Project Detail's own "Project Details" card
                        (dash-chart-card/project-info-card/project-info-row) —
                        this used to be a plain .list-table-format 2-column
                        table, the same generic row shape that mangled every
                        other label/value list on this page's counterparts
                        before this pass. Card-first, then the KPI/chart
                        summary below it, mirrors Project Detail's own
                        Overview tab order exactly. */}
                    <div className="dash-chart-card project-info-card" style={{ marginBottom: '24px' }}>
                        <p className="dash-chart-title">Client Details</p>
                        <div className="project-info-row"><b>Name</b><p>{client.name}</p></div>
                        <div className="project-info-row"><b>Phone</b><p>{client.phone || '-'}</p></div>
                        <div className="project-info-row"><b>Email</b><p>{client.email || '-'}</p></div>
                        <div className="project-info-row"><b>Address</b><p>{client.address || '-'}</p></div>
                        <div className="project-info-row"><b>GST Number</b><p>{client.gstNumber || '-'}</p></div>
                        <div className="project-info-row"><b>Total Projects</b><p>{projectCount ?? '-'}</p></div>
                        <div className="project-info-row"><b>Notes</b><p>{client.notes || '-'}</p></div>
                    </div>
                    <ClientDashboardSummary url={url} clientId={client._id} />
                    {/* Same full-width pill as ProjectOverviewTab's own "View
                        all Works" — Total Projects above already shows the
                        count, this is the actual way to get there. */}
                    <button type="button" className="dash-activity-viewall" onClick={() => setActiveTab('projects')}>
                        View all Projects
                        <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                </div>
            )}
            {activeTab === 'projects' && <ClientProjectsTab url={url} clientId={client._id} />}
            {activeTab === 'quotations' && <ClientQuotationsTab url={url} clientId={client._id} />}
            {activeTab === 'receipts' && <ClientReceiptsTab url={url} clientId={client._id} />}
            {activeTab === 'bills' && <ClientBillsTab url={url} clientId={client._id} />}
            {activeTab === 'documents' && (
                <DocumentsTab
                    url={url} apiBase="client-documents" scopeParam="clientId" scopeId={client._id}
                    title="Documents" subtitle="KYC, GSTIN, and general agreements; outlives any one project."
                    emptyText="No documents on file for this client yet."
                />
            )}
            {activeTab === 'contacts' && <ClientContactsTab url={url} clientId={client._id} />}
            {activeTab === 'payments' && <ClientPaymentHistoryTab url={url} clientId={client._id} />}
            {activeTab === 'ledger' && <ClientLedgerTab url={url} clientId={client._id} />}
        </FinanceTabShell>
    );
};

export default ClientDetail;
