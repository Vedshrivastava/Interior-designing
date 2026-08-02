import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledMonthPicker from './StyledMonthPicker';
import '../../styles/list.css';
import '../../styles/add.css';

const thisMonth = () => new Date().toISOString().slice(0, 7);

/* Guided month-end checklist — every row reuses a number Reports already
   computes elsewhere (Labour/Vendor Analysis, CA Monthly Package, Clients
   aging); "Approve entries" is the one genuinely new company-wide count.
   Rows with a linkTab jump straight to that Reports tab (onNavigate is
   ReportsPage's own setActiveTab); the two rows whose real workspace
   lives outside Reports (Work Review, Running Bills — both under
   Receivables) show a plain hint instead. */
const ReconciliationChecklist = ({ url, onNavigate }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [month, setMonth] = useState(thisMonth());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchChecklist = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/reports/reconciliation`, { ...authHeader, params: { month } });
            if (res.data.success) setData(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching reconciliation checklist'); }
        finally { setLoading(false); }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div className="add-product-name flex-col">
                    <p>Month</p>
                    <StyledMonthPicker value={month} onChange={v => setMonth(v || thisMonth())} />
                </div>
                <button type="button" className="add-point-btn" disabled={loading} onClick={fetchChecklist}>{loading ? 'Loading…' : 'Check Month'}</button>
            </div>

            {data && (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '16px', fontWeight: 600, color: data.allClear ? 'var(--moss)' : '#c0392b' }}>
                        {data.allClear ? 'All clear for this month.' : `${data.outstandingCount} item${data.outstandingCount === 1 ? '' : 's'} outstanding.`}
                    </p>

                    <div className="dash-chart-card rec-card">
                        <div className="rec-row rec-header">
                            <b className="rec-item">Item</b>
                            <b className="rec-count">Count</b>
                            <b className="rec-amount">Amount</b>
                            <b className="rec-status">Status</b>
                        </div>
                        {data.items.map(item => (
                            <div key={item.key} className="rec-row">
                                <p className="rec-item">{item.label}</p>
                                <p className="rec-count"><span className="pq-group-label">Count</span>{item.count === null ? '—' : item.count}</p>
                                <p className="rec-amount"><span className="pq-group-label">Amount</span>{item.amount === null ? '—' : `₹${item.amount.toLocaleString('en-IN')}`}</p>
                                <p className="rec-status">
                                    {item.clear ? (
                                        <span style={{ color: 'var(--moss)', fontWeight: 600 }}>Clear</span>
                                    ) : item.linkTab ? (
                                        <span className="cursor edit-action" onClick={() => onNavigate(item.linkTab)}>Review →</span>
                                    ) : (
                                        <span style={{ color: 'var(--text-lt)', fontSize: '0.8rem' }}>{item.hint}</span>
                                    )}
                                </p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ReconciliationChecklist;
