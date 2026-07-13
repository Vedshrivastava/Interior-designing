import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

const CATEGORY_LABEL = { receipt: 'Receipts', contractor: 'Contractor Payments', vendor: 'Vendor Payments', salary: 'Salary Payments', commission: 'Commission Payments', expense: 'Expenses' };

/* No charting library is used anywhere else in this codebase (see
   CashBookSummaryView for the same plain-table convention) — a table per
   bucket is the honest choice here rather than introducing one just for
   this tab. */
const CashFlowView = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [from, setFrom] = useState(firstOfMonth());
    const [to, setTo] = useState(today());
    const [groupBy, setGroupBy] = useState('day');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchFlow = async () => {
        if (!from || !to) return toast.error('Both dates are required');
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/reports/cash-flow`, { ...authHeader, params: { from, to, groupBy } });
            if (res.data.success) setData(res.data.data);
        } catch { toast.error('Error fetching cash flow'); }
        finally { setLoading(false); }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div className="add-product-name flex-col">
                    <p>From</p>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
                </div>
                <div className="add-product-name flex-col">
                    <p>To</p>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} />
                </div>
                <div className="add-product-name flex-col">
                    <p>Group by</p>
                    <select value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                        <option value="day">Day</option>
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                    </select>
                </div>
                <button type="button" className="add-point-btn" disabled={loading} onClick={fetchFlow}>{loading ? 'Loading…' : 'Get Cash Flow'}</button>
            </div>

            {data && (
                <>
                    <div className="list-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <b>Total In</b><b>Total Out</b><b>Net</b>
                        </div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <p style={{ color: 'var(--moss)' }}>₹{data.totals.in.toLocaleString('en-IN')}</p>
                            <p style={{ color: '#c0392b' }}>₹{data.totals.out.toLocaleString('en-IN')}</p>
                            <p style={{ fontWeight: 700 }}>₹{data.totals.net.toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By category</p>
                    <div className="list-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
                            <b>Category</b><b>Direction</b><b>Amount</b>
                        </div>
                        {data.byCategory.map(c => (
                            <div key={c.category} className="list-table-format row-item" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
                                <p>{CATEGORY_LABEL[c.category] || c.category}</p>
                                <p style={{ color: c.direction === 'in' ? 'var(--moss)' : '#c0392b' }}>{c.direction === 'in' ? 'In' : 'Out'}</p>
                                <p>₹{c.amount.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By {groupBy}</p>
                    <div className="list-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            <b>Period</b><b>In</b><b>Out</b><b>Net</b>
                        </div>
                        {data.series.length === 0 ? (
                            <div className="admin-empty-state"><p>No activity in this range.</p></div>
                        ) : data.series.map(s => (
                            <div key={s.bucket} className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                <p>{s.bucket}</p>
                                <p style={{ color: 'var(--moss)' }}>₹{s.in.toLocaleString('en-IN')}</p>
                                <p style={{ color: '#c0392b' }}>₹{s.out.toLocaleString('en-IN')}</p>
                                <p style={{ fontWeight: 600 }}>₹{s.net.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default CashFlowView;
