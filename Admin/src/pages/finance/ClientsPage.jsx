import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import { ChartCard, ChartGrid, EmptyChart, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
import '../../styles/list.css';
import '../../styles/dashboard.css';

const AGE_BUCKETS = ['0-30', '30-60', '60-90', '90+'];

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

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sortKey, setSortKey] = useState('totalBilled');

    useEffect(() => {
        setLoading(true);
        axios.get(`${url}/api/finance/reports/clients-summary`, authHeader)
            .then(res => { if (res.data.success) setSummary(res.data.data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const clients = summary?.clients || [];
    const sorted = [...clients].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
    const topClients = sorted.slice(0, 8).map(c => ({ name: c.clientName, revenue: c.totalBilled }));
    const agingData = summary ? AGE_BUCKETS.map(bucket => ({ bucket, amount: summary.aging[bucket] })) : [];

    const sortableHeader = (key, label) => (
        <b style={{ cursor: 'pointer' }} onClick={() => setSortKey(key)}>{label}{sortKey === key ? ' ▾' : ''}</b>
    );

    return (
        <FinanceTabShell label="Clients" subtitle="Client master — billed, received, and outstanding at a glance. Click a client to open their detail view.">
            {!loading && clients.length > 0 && (
                <>
                    <ChartGrid>
                        <ChartCard title="Top Clients by Revenue">
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={topClients} layout="vertical" margin={{ left: 24 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                                    <Tooltip formatter={(v) => formatINR(v)} />
                                    <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>
                        <ChartCard title="Receivables Aging">
                            {agingData.some(a => a.amount > 0) ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={agingData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip formatter={(v) => formatINR(v)} />
                                        <Bar dataKey="amount" name="Outstanding" radius={[4, 4, 0, 0]}>
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
                        {sorted.map(c => (
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

            <MasterCrudTable url={url} resourceKey="clients" getDetailLink={(item) => `/finance/clients/${item._id}`} />
        </FinanceTabShell>
    );
};

export default ClientsPage;
