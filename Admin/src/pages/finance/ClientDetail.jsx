import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import StyledDatePicker from '../../components/finance/StyledDatePicker';
import { KpiCard, KpiGrid, ChartCard, ChartGrid, EmptyChart, CHART_COLORS, formatINR } from '../../components/finance/DashboardWidgets';
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
                <KpiCard label="Total Billed" value={formatINR(detail.totalBilled)} />
                <KpiCard label="Total Received" value={formatINR(detail.totalReceived)} />
                <KpiCard label="Outstanding" value={formatINR(detail.outstanding)} tone={detail.outstanding > 0 ? 'danger' : 'good'} />
                <KpiCard label="Margin %" value={`${Math.round((detail.marginPercent || 0) * 10) / 10}%`} tone={detail.marginPercent >= 0 ? 'good' : 'danger'} />
            </KpiGrid>
            <ChartGrid>
                <ChartCard title="Receivables Aging">
                    {agingData.some(a => a.amount > 0) ? (
                        <ResponsiveContainer width="100%" height={220}>
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
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>{projects.length} project{projects.length === 1 ? '' : 's'} given to us.</p>
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 2fr' }}>
                    <b>Name</b><b>Contract Type</b><b>Status</b><b>Work Types</b>
                </div>
                {projects.map(p => (
                    <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.6fr 1fr 1fr 2fr' }}>
                        <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/projects/${p._id}`)}>{p.name}</p>
                        <p><span className="item-category">{CONTRACT_TYPE_LABEL[p.contractType]}</span></p>
                        <p><span className="item-category">{STATUS_LABEL[p.status]}</span></p>
                        <p>{p.workTypes.length > 0 ? p.workTypes.join(', ') : '—'}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

/*
 * Bills, Payment History, and Ledger all come from the same two sources —
 * this client's running bills (fetched per-project, since the bills
 * endpoint only filters by projectId) and their receipts (which the
 * receipts endpoint filters by clientId directly). Fetched once, shared
 * across the three tabs, rather than three separate N+1 fan-outs.
 */
const useClientBillsAndReceipts = (url, clientId) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [bills, setBills] = useState([]);
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
                const billLists = await Promise.all(clientProjects.map(p =>
                    axios.get(`${url}/api/finance/running-bills/list`, { ...authHeader, params: { projectId: p._id } })
                        .then(res => (res.data.success ? res.data.data.map(b => ({ ...b, projectName: p.name })) : []))
                        .catch(() => [])
                ));
                if (!cancelled) {
                    setBills(billLists.flat());
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

    return { bills, receipts, loading };
};

const ClientBillsTab = ({ url, clientId }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const { bills, loading } = useClientBillsAndReceipts(url, clientId);

    // Protected download — the PDF endpoint needs the Bearer token, so a
    // plain <a href> won't carry auth; fetch as a blob and trigger the
    // save via a throwaway anchor instead. Same pattern as
    // RunningBillsManager's own "Statement" action.
    const downloadStatement = async (b) => {
        try {
            const res = await axios.get(`${url}/api/finance/running-bills/${b._id}/statement/download`, { ...authHeader, responseType: 'blob' });
            const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const a = document.createElement('a');
            a.href = blobUrl; a.download = `Bill-Statement-${b.billNumber}.pdf`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch { toast.error('Error downloading statement'); }
    };

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (bills.length === 0) return <div className="admin-empty-state"><p>No bills raised for this client yet.</p></div>;

    return (
        <div className="list-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 0.7fr 1fr 1fr 1fr 120px' }}>
                <b>Project</b><b>Bill #</b><b>Date</b><b>Total</b><b>Status</b><b>Action</b>
            </div>
            {bills.map(b => (
                <div key={b._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 0.7fr 1fr 1fr 1fr 120px' }}>
                    <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/projects/${b.projectId}`)}>{b.projectName}</p>
                    <p>#{b.billNumber}</p>
                    <p>{new Date(b.billDate).toLocaleDateString()}</p>
                    <p>₹{b.totalAmount.toLocaleString('en-IN')}</p>
                    <p><span className="item-category">{BILL_STATUS_LABEL[b.status]}</span></p>
                    <div className="action-buttons">
                        <p onClick={() => downloadStatement(b)} className="cursor edit-action">Statement</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

const ClientReceiptsTab = ({ url, clientId }) => {
    const { receipts, loading } = useClientBillsAndReceipts(url, clientId);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (receipts.length === 0) return <div className="admin-empty-state"><p>No receipts recorded for this client yet.</p></div>;

    return (
        <div className="list-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                <b>Date</b><b>Amount</b><b>Mode</b><b>Reference</b>
            </div>
            {receipts.map(r => (
                <div key={r._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                    <p>{new Date(r.receiptDate).toLocaleDateString()}</p>
                    <p>₹{r.amount.toLocaleString('en-IN')}</p>
                    <p>{r.paymentMode || '—'}</p>
                    <p>{r.utrNumber || r.bankOrCashLabel || '—'}</p>
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
        ...bills.filter(b => b.status === 'issued').map(b => ({ type: 'bill', date: b.billDate, amount: b.totalAmount, label: `Bill #${b.billNumber} issued — ${b.projectName}` })),
        ...receipts.map(r => ({ type: 'receipt', date: r.receiptDate, amount: r.amount, label: `Receipt received${r.paymentMode ? ` (${r.paymentMode})` : ''}` })),
    ];
    return { feed, loading };
};

const ClientPaymentHistoryTab = ({ url, clientId }) => {
    const { feed, loading } = useMergedFeed(url, clientId);
    const sorted = [...feed].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (sorted.length === 0) return <div className="admin-empty-state"><p>No billing activity for this client yet.</p></div>;

    return (
        <div className="list-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 2fr 1fr' }}>
                <b>Date</b><b>Event</b><b>Amount</b>
            </div>
            {sorted.map((e, i) => (
                <div key={i} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 2fr 1fr' }}>
                    <p>{new Date(e.date).toLocaleDateString()}</p>
                    <p>{e.label}</p>
                    <p style={{ color: e.type === 'bill' ? '#c0392b' : 'var(--moss)' }}>{e.type === 'bill' ? '+' : '−'}₹{e.amount.toLocaleString('en-IN')}</p>
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
        <div className="list-table">
            <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 2fr 1fr 1fr' }}>
                <b>Date</b><b>Event</b><b>Amount</b><b>Balance</b>
            </div>
            {withBalance.map((e, i) => (
                <div key={i} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 2fr 1fr 1fr' }}>
                    <p>{new Date(e.date).toLocaleDateString()}</p>
                    <p>{e.label}</p>
                    <p style={{ color: e.type === 'bill' ? '#c0392b' : 'var(--moss)' }}>{e.type === 'bill' ? '+' : '−'}₹{e.amount.toLocaleString('en-IN')}</p>
                    <p style={{ fontWeight: 600 }}>₹{e.balance.toLocaleString('en-IN')}</p>
                </div>
            ))}
        </div>
    );
};

const QUOTATION_STATUS_LABEL = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', expired: 'Expired' };

const ClientQuotationsTab = ({ url, clientId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ date: '', amount: '', validUntil: '', notes: '' });
    const [saving, setSaving] = useState(false);

    const fetchList = () => {
        setLoading(true);
        axios.get(`${url}/api/finance/client-quotations/list`, { ...authHeader, params: { clientId } })
            .then(res => { if (res.data.success) setQuotations(res.data.data); })
            .catch(() => toast.error('Error fetching quotations'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchList(); }, [url, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.date) return toast.error('Date is required');
        if (form.amount === '') return toast.error('Amount is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/client-quotations/add`,
                { clientId, date: form.date, amount: form.amount, validUntil: form.validUntil || null, notes: form.notes }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Quotation added');
                setForm({ date: '', amount: '', validUntil: '', notes: '' });
                fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding quotation');
        } finally { setSaving(false); }
    };

    const changeStatus = async (_id, status) => {
        try {
            const res = await axios.post(`${url}/api/finance/client-quotations/status`, { _id, status }, authHeader);
            if (res.data.success) { toast.success(res.data.message); fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error updating status'); }
    };

    const remove = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/client-quotations/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing quotation'); }
    };

    return (
        <div>
            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Date *</p>
                        <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Amount (₹) *</p>
                        <input type="number" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Valid Until</p>
                        <StyledDatePicker value={form.validUntil} onChange={v => setField('validUntil', v)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Notes</p>
                        <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Adding…' : '+ Add Quotation'}</button>
                </div>
            </form>

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : quotations.length === 0 ? (
                <div className="admin-empty-state"><p>No quotations issued to this client yet.</p></div>
            ) : (
                <div className="list-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '70px 1fr 1fr 1fr 110px 160px' }}>
                        <b>#</b><b>Date</b><b>Amount</b><b>Valid Until</b><b>Status</b><b>Action</b>
                    </div>
                    {quotations.map(q => (
                        <div key={q._id} className="list-table-format row-item" style={{ gridTemplateColumns: '70px 1fr 1fr 1fr 110px 160px' }}>
                            <p>#{q.quotationNumber}</p>
                            <p>{new Date(q.date).toLocaleDateString()}</p>
                            <p>₹{q.amount.toLocaleString('en-IN')}</p>
                            <p>{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}</p>
                            <p><span className="item-category">{QUOTATION_STATUS_LABEL[q.status]}</span></p>
                            <div className="action-buttons">
                                {q.status === 'pending' ? (
                                    <>
                                        <p onClick={() => changeStatus(q._id, 'accepted')} className="cursor edit-action">Accept</p>
                                        <p onClick={() => changeStatus(q._id, 'rejected')} className="cursor delete-action">Reject</p>
                                    </>
                                ) : (
                                    <p onClick={() => changeStatus(q._id, 'pending')} className="cursor edit-action">Reopen</p>
                                )}
                                <p onClick={() => remove(q._id)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ClientDocumentsTab = ({ url, clientId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);

    const fetchList = () => {
        setLoading(true);
        axios.get(`${url}/api/finance/client-documents/list`, { ...authHeader, params: { clientId } })
            .then(res => { if (res.data.success) setDocuments(res.data.data); })
            .catch(() => toast.error('Error fetching documents'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchList(); }, [url, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    const submit = async (e) => {
        e.preventDefault();
        if (!file) return toast.error('Choose a file first');
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('clientId', clientId);
            formData.append('name', name || file.name);
            formData.append('notes', notes);
            formData.append('file', file);
            const res = await axios.post(`${url}/api/finance/client-documents/add`, formData, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) {
                toast.success(res.data.message || 'Document uploaded');
                setName(''); setNotes(''); setFile(null);
                const input = document.getElementById('client-doc-file-input');
                if (input) input.value = '';
                fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error uploading document');
        } finally { setSaving(false); }
    };

    const remove = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/client-documents/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing document'); }
    };

    return (
        <div>
            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>File *</p>
                        <input id="client-doc-file-input" type="file" onChange={e => setFile(e.target.files[0])} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Name</p>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Defaults to file name" />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Notes</p>
                        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Uploading…' : '+ Upload Document'}</button>
                </div>
            </form>

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : documents.length === 0 ? (
                <div className="admin-empty-state"><p>No documents on file for this client yet.</p></div>
            ) : (
                <div className="list-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1.5fr 1fr 1.5fr 140px' }}>
                        <b>Name</b><b>Uploaded</b><b>Notes</b><b>Action</b>
                    </div>
                    {documents.map(d => (
                        <div key={d._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.5fr 1fr 1.5fr 140px' }}>
                            <p>{d.name}</p>
                            <p>{new Date(d.createdAt).toLocaleDateString()}</p>
                            <p>{d.notes || '—'}</p>
                            <div className="action-buttons">
                                <a href={d.fileUrl} target="_blank" rel="noreferrer" className="cursor edit-action" style={{ textDecoration: 'none' }}>View</a>
                                <p onClick={() => remove(d._id)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const emptyContactForm = { name: '', designation: '', phone: '', email: '', notes: '' };

const ClientContactsTab = ({ url, clientId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyContactForm);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);

    const fetchList = () => {
        setLoading(true);
        axios.get(`${url}/api/finance/client-contacts/list`, { ...authHeader, params: { clientId } })
            .then(res => { if (res.data.success) setContacts(res.data.data); })
            .catch(() => toast.error('Error fetching contacts'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchList(); }, [url, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const openEdit = (c) => {
        setEditingId(c._id);
        setForm({ name: c.name, designation: c.designation || '', phone: c.phone || '', email: c.email || '', notes: c.notes || '' });
    };

    const cancelEdit = () => { setEditingId(null); setForm(emptyContactForm); };

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
                cancelEdit();
                fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving contact');
        } finally { setSaving(false); }
    };

    const remove = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/client-contacts/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing contact'); }
    };

    return (
        <div>
            <form onSubmit={submit}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Name *</p>
                        <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Designation</p>
                        <input type="text" value={form.designation} onChange={e => setField('designation', e.target.value)} placeholder="e.g. Site Engineer" />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Phone</p>
                        <input type="text" value={form.phone} onChange={e => setField('phone', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Email</p>
                        <input type="text" value={form.email} onChange={e => setField('email', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Notes</p>
                        <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    {editingId ? <button type="button" className="add-btn cancel-btn" onClick={cancelEdit}>Cancel</button> : <span />}
                    <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Contact' : '+ Add Contact'}</button>
                </div>
            </form>

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : contacts.length === 0 ? (
                <div className="admin-empty-state"><p>No additional contact persons for this client yet.</p></div>
            ) : (
                <div className="list-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1.3fr 120px' }}>
                        <b>Name</b><b>Designation</b><b>Phone</b><b>Email</b><b>Action</b>
                    </div>
                    {contacts.map(c => (
                        <div key={c._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1.3fr 120px' }}>
                            <p>{c.name}</p>
                            <p>{c.designation || '—'}</p>
                            <p>{c.phone || '—'}</p>
                            <p>{c.email || '—'}</p>
                            <div className="action-buttons">
                                <p onClick={() => openEdit(c)} className="cursor edit-action">Edit</p>
                                <p onClick={() => remove(c._id)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))}
                </div>
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
        return <div className="list add flex-col"><div className="admin-list-container"><div className="admin-empty-state"><p>Loading…</p></div></div></div>;
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
                <ClientDashboardSummary url={url} clientId={client._id} />
                <div className="list-table">
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Name</b></p><p>{client.name}</p></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Phone</b></p><p>{client.phone || '—'}</p></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Email</b></p><p>{client.email || '—'}</p></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Address</b></p><p>{client.address || '—'}</p></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>GST Number</b></p><p>{client.gstNumber || '—'}</p></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Total Projects</b></p><p style={{ cursor: 'pointer' }} onClick={() => setActiveTab('projects')}>{projectCount ?? '—'}</p></div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr' }}><p><b>Notes</b></p><p>{client.notes || '—'}</p></div>
                </div>
                </div>
            )}
            {activeTab === 'projects' && <ClientProjectsTab url={url} clientId={client._id} />}
            {activeTab === 'quotations' && <ClientQuotationsTab url={url} clientId={client._id} />}
            {activeTab === 'receipts' && <ClientReceiptsTab url={url} clientId={client._id} />}
            {activeTab === 'bills' && <ClientBillsTab url={url} clientId={client._id} />}
            {activeTab === 'documents' && <ClientDocumentsTab url={url} clientId={client._id} />}
            {activeTab === 'contacts' && <ClientContactsTab url={url} clientId={client._id} />}
            {activeTab === 'payments' && <ClientPaymentHistoryTab url={url} clientId={client._id} />}
            {activeTab === 'ledger' && <ClientLedgerTab url={url} clientId={client._id} />}
        </FinanceTabShell>
    );
};

export default ClientDetail;
