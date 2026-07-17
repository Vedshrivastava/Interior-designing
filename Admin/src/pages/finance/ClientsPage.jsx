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
            subtitle="Client master — billed, received, and outstanding at a glance. Click a client to open their detail view."
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

                    <div className="list-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr' }}>
                            <b>Client</b>
                            {sortableHeader('totalBilled', 'Billed')}
                            {sortableHeader('totalReceived', 'Received')}
                            {sortableHeader('outstanding', 'Outstanding')}
                        </div>
                        {loading ? (
                            <div className="admin-empty-state"><p>Loading…</p></div>
                        ) : sorted.map(c => (
                            <div key={c.clientId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 1fr' }}>
                                <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/clients/${c.clientId}`)}>{c.clientName}</p>
                                <p>{formatINR(c.totalBilled)}</p>
                                <p>{formatINR(c.totalReceived)}</p>
                                <p style={{ color: c.outstanding > 0 ? '#c0392b' : 'var(--moss)' }}>{formatINR(c.outstanding)}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <MasterCrudTable ref={clientTableRef} url={url} resourceKey="clients" getDetailLink={(item) => `/finance/clients/${item._id}`} hideAddButton />
        </FinanceTabShell>
    );
};

export default ClientsPage;
