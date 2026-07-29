import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import { ChartCard, ChartGrid, EmptyChart, ChartSkeleton, ChartTooltip, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
import '../../styles/list.css';
import '../../styles/dashboard.css';

const AGE_BUCKETS = ['0-30', '30-60', '60-90', '90+'];

const getInitials = (name = '') =>
    name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

// Kept outside the component so it survives a route remount, same as
// FinanceHome.jsx's dashboardCache — navigating away and back to Clients
// shows the last-known summary instantly instead of every chart/table
// reverting to a loading state again, while a fresh fetch quietly brings
// it up to date in the background. Only a genuine first load (no cache
// yet) shows any loading state at all.
let clientsSummaryCache = null;

/*
 * Tier 1 mini-dashboard for Clients — billed/received/outstanding per
 * client, top clients by revenue, and receivables aging, on top of the
 * existing client master CRUD table (relocated out of Master Data, kept
 * as-is below the new summary). Row clicks (both the summary table and
 * MasterCrudTable's own) still go to /finance/clients/:id (Tier 2).
 */
const ClientsPage = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [summary, setSummary] = useState(clientsSummaryCache);
    const [loading, setLoading] = useState(!clientsSummaryCache);
    const [sortKey, setSortKey] = useState('totalBilled');
    const [clientQuery, setClientQuery] = useState('');
    const clientTableRef = useRef(null);

    const fetchSummary = () => {
        axios.get(`${url}/api/finance/reports/clients-summary`, authHeader)
            .then(res => { if (res.data.success) { setSummary(res.data.data); clientsSummaryCache = res.data.data; } })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (clientsSummaryCache) { setSummary(clientsSummaryCache); setLoading(false); }
        else setLoading(true);
        fetchSummary();
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // clients-summary rolls up FinanceClient + FinanceProject + FinanceRunningBill
    // + FinanceReceipt — any of those changing elsewhere (a bill issued, a
    // receipt logged) should update this page without needing a revisit.
    useFinanceWsRefresh(['financeClientsChanged', 'financeProjectsChanged', 'financeRunningBillsChanged', 'financeReceiptsChanged'], fetchSummary);

    const clients = summary?.clients || [];
    const sorted = [...clients].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
    const topClients = sorted.slice(0, 8).map(c => ({ name: c.clientName, revenue: c.totalBilled, clientId: c.clientId }));
    const agingData = summary ? AGE_BUCKETS.map(bucket => ({ bucket, amount: summary.aging[bucket] })) : [];

    const sortableHeader = (key, label) => (
        <b style={{ cursor: 'pointer' }} onClick={() => setSortKey(key)}>{label}{sortKey === key ? ' ▾' : ''}</b>
    );

    return (
        <FinanceTabShell
            label="Clients"
            subtitle="Client master: billed, received, and outstanding at a glance. Click a client to open their detail view."
            headerAction={<button type="button" className="add-btn" style={{ minWidth: 'auto', padding: '12px 24px', alignSelf: 'center' }} onClick={() => clientTableRef.current?.openAdd()}>+ Add Client</button>}
        >
            {(loading || clients.length > 0) && (
                <>
                    <ChartGrid>
                        <ChartCard title="Top Clients by Revenue">
                            {loading ? <ChartSkeleton /> : (
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={topClients} layout="vertical" margin={{ left: 24 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,168,124,0.08)' }} />
                                        <Bar
                                            dataKey="revenue" name="Revenue" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} activeBar={false}
                                            cursor="pointer" onClick={(data) => navigate(`/finance/clients/${data.clientId}`)}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                        <ChartCard title="Receivables Aging">
                            {loading ? <ChartSkeleton /> : agingData.some(a => a.amount > 0) ? (
                                <ResponsiveContainer width="100%" height={240}>
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

                    {/* Hoisted above the summary card (and shared with the client
                        directory further down, via MasterCrudTable's controlled-
                        search props) rather than living inside either — one search
                        box for both, positioned where it reads as a page-level
                        control rather than being buried under one specific table. */}
                    <div className="admin-search-wrap" style={{ marginBottom: '20px' }}>
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            type="text"
                            placeholder="Search clients…"
                            value={clientQuery}
                            onChange={e => setClientQuery(e.target.value)}
                        />
                        {clientQuery && <button className="admin-search-clear" onClick={() => setClientQuery('')}>×</button>}
                    </div>

                    {/* Its own class, not .list-table-format — that class carries a
                        heavy !important mobile transform in list.css built for a
                        different row shape (image + title + subtitle + action
                        buttons), which mangled this table's 4 financial columns the
                        same way it originally did on the Activity Timeline page. */}
                    <div className="dash-chart-card client-summary-card" style={{ marginBottom: '24px' }}>
                        <div className="client-summary-head">
                            <p className="dash-chart-title">Client Summary</p>
                            {/* Column headers (which carry sorting on desktop) are
                                hidden once rows stack into cards on mobile — this is
                                the replacement way to change sort there. */}
                            <select
                                className="client-summary-mobile-sort"
                                value={sortKey}
                                onChange={e => setSortKey(e.target.value)}
                                aria-label="Sort clients by"
                            >
                                <option value="totalBilled">Sort: Billed</option>
                                <option value="totalReceived">Sort: Received</option>
                                <option value="outstanding">Sort: Outstanding</option>
                            </select>
                        </div>
                        <div className="client-summary-row client-summary-header">
                            <span className="client-summary-header-label">Client</span>
                            {sortableHeader('totalBilled', 'Billed')}
                            {sortableHeader('totalReceived', 'Received')}
                            {sortableHeader('outstanding', 'Outstanding')}
                        </div>
                        {loading ? (
                            <div className="dash-empty">Loading…</div>
                        ) : sorted.map(c => (
                            <div key={c.clientId} className="client-summary-row">
                                <div className="client-summary-name-wrap" onClick={() => navigate(`/finance/clients/${c.clientId}`)}>
                                    <span className="client-avatar"><span className="client-avatar-initials">{getInitials(c.clientName)}</span></span>
                                    <p className="client-summary-name">{c.clientName}</p>
                                </div>
                                <div className="client-summary-figure cs-billed">
                                    <span className="client-summary-label">Billed</span>
                                    <span className="client-summary-value">{formatINR(c.totalBilled)}</span>
                                </div>
                                <div className="client-summary-figure cs-received">
                                    <span className="client-summary-label">Received</span>
                                    <span className="client-summary-value">{formatINR(c.totalReceived)}</span>
                                </div>
                                <div className="client-summary-figure cs-outstanding">
                                    <span className="client-summary-label">Outstanding</span>
                                    <span className={`client-summary-value client-summary-status-pill ${c.outstanding > 0 ? 'is-due' : 'is-clear'}`}>
                                        {formatINR(c.outstanding)}
                                    </span>
                                    {c.clientCreditBalance > 0 && (
                                        <span className="client-summary-credit">{formatINR(c.clientCreditBalance)} credit</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <MasterCrudTable
                ref={clientTableRef}
                url={url}
                resourceKey="clients"
                getDetailLink={(item) => `/finance/clients/${item._id}`}
                hideAddButton
                cardTitle="Client Directory"
                searchQuery={clientQuery}
                onSearchChange={setClientQuery}
            />
        </FinanceTabShell>
    );
};

export default ClientsPage;
