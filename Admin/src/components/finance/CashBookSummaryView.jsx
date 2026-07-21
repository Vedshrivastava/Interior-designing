import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import '../../styles/list.css';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

/* Opening + closing cash balance for a date range — no separate "opening
   balance" field exists anywhere; opening is just the running total of
   every cash entry before dateFrom, computed fresh server-side. */
const CashBookSummaryView = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [dateFrom, setDateFrom] = useState(firstOfMonth());
    const [dateTo, setDateTo] = useState(today());
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchSummary = async () => {
        if (!dateFrom || !dateTo) return toast.error('Both dates are required');
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/cash-book/summary`, { ...authHeader, params: { dateFrom, dateTo } });
            if (res.data.success) setSummary(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching summary'); }
        finally { setLoading(false); }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div className="add-product-name flex-col">
                    <p>From</p>
                    <StyledDatePicker value={dateFrom} onChange={setDateFrom} />
                </div>
                <div className="add-product-name flex-col">
                    <p>To</p>
                    <StyledDatePicker value={dateTo} onChange={setDateTo} />
                </div>
                <button type="button" className="add-point-btn" disabled={loading} onClick={fetchSummary}>{loading ? 'Loading…' : 'Get Summary'}</button>
            </div>

            {summary && (
                <div className="list-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                        <b>Opening Balance</b><b>Cash In</b><b>Cash Out</b><b>Closing Balance</b>
                    </div>
                    <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                        <p>₹{summary.openingBalance.toLocaleString('en-IN')}</p>
                        <p style={{ color: 'var(--moss)' }}>₹{summary.inTotal.toLocaleString('en-IN')}</p>
                        <p style={{ color: '#c0392b' }}>₹{summary.outTotal.toLocaleString('en-IN')}</p>
                        <p style={{ fontWeight: 700 }}>₹{summary.closingBalance.toLocaleString('en-IN')}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashBookSummaryView;
