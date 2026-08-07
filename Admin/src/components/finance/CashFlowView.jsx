import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import StyledSelect from './StyledSelect';
import { KpiCard, KpiGrid } from './DashboardWidgets';
import '../../styles/list.css';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

const CATEGORY_LABEL = {
    receipt: 'Receipts', vendorRefund: 'Vendor Refunds',
    contractor: 'Contractor Payments', vendor: 'Vendor Payments', salary: 'Salary Payments',
    labour: 'Labour Payments', commission: 'Commission Payments', labourProvider: 'Labour Provider Payments',
    expense: 'Expenses', tdsDeposit: 'TDS Deposited',
    manualCashIn: 'Manual Cash In', manualBankIn: 'Manual Bank In',
    manualCash: 'Manual Cash Out', manualBank: 'Manual Bank Out',
};

const GROUP_BY_OPTIONS = [
    { value: 'day',   label: 'Day' },
    { value: 'week',  label: 'Week' },
    { value: 'month', label: 'Month' },
];

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
                    <StyledDatePicker value={from} onChange={setFrom} />
                </div>
                <div className="add-product-name flex-col">
                    <p>To</p>
                    <StyledDatePicker value={to} onChange={setTo} />
                </div>
                <div className="add-product-name flex-col">
                    <p>Group by</p>
                    <StyledSelect value={groupBy} onChange={setGroupBy} options={GROUP_BY_OPTIONS} />
                </div>
                <button type="button" className="add-point-btn" disabled={loading} onClick={fetchFlow}>{loading ? 'Loading…' : 'Get Cash Flow'}</button>
            </div>

            {data && (
                <>
                    <KpiGrid>
                        <KpiCard label="Total In" value={`₹${data.totals.in.toLocaleString('en-IN')}`} tone="good" />
                        <KpiCard label="Total Out" value={`₹${data.totals.out.toLocaleString('en-IN')}`} tone="danger" />
                        <KpiCard label="Net" value={`₹${data.totals.net.toLocaleString('en-IN')}`} />
                    </KpiGrid>

                    <p className="admin-subtitle" style={{ margin: '24px 0 10px' }}>By category</p>
                    <div className="dash-chart-card rcf-cat-card" style={{ marginBottom: '24px' }}>
                        <div className="rcf-cat-row rcf-cat-header">
                            <b className="rcf-cat-category">Category</b>
                            <b className="rcf-cat-direction">Direction</b>
                            <b className="rcf-cat-amount">Amount</b>
                        </div>
                        {data.byCategory.map(c => (
                            <div key={c.category} className="rcf-cat-row">
                                <p className="rcf-cat-category">{CATEGORY_LABEL[c.category] || c.category}</p>
                                <p className="rcf-cat-direction" style={{ color: c.direction === 'in' ? 'var(--moss)' : '#c0392b' }}><span className="pq-group-label">Direction</span>{c.direction === 'in' ? 'In' : 'Out'}</p>
                                <p className="rcf-cat-amount"><span className="pq-group-label">Amount</span>₹{c.amount.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By {groupBy}</p>
                    <div className="dash-chart-card rcf-series-card">
                        <div className="rcf-series-row rcf-series-header">
                            <b className="rcf-series-period">Period</b>
                            <b className="rcf-series-in">In</b>
                            <b className="rcf-series-out">Out</b>
                            <b className="rcf-series-net">Net</b>
                        </div>
                        {data.series.length === 0 ? (
                            <div className="admin-empty-state"><p>No activity in this range.</p></div>
                        ) : data.series.map(s => (
                            <div key={s.bucket} className="rcf-series-row">
                                <p className="rcf-series-period">{s.bucket}</p>
                                <p className="rcf-series-in" style={{ color: 'var(--moss)' }}><span className="pq-group-label">In</span>₹{s.in.toLocaleString('en-IN')}</p>
                                <p className="rcf-series-out" style={{ color: '#c0392b' }}><span className="pq-group-label">Out</span>₹{s.out.toLocaleString('en-IN')}</p>
                                <p className="rcf-series-net" style={{ fontWeight: 600 }}><span className="pq-group-label">Net</span>₹{s.net.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default CashFlowView;
