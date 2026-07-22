import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFileDownload } from '../../hooks/useFileDownload';
import DownloadButton from './DownloadButton';
import '../../styles/list.css';

const thisMonth = () => new Date().toISOString().slice(0, 7);

/* Month picker + preview of every number that lands in the downloadable
   PDF — the JSON preview and the PDF come from the exact same backend
   computation (computeCaMonthlyPackage), so what's shown here is always
   what gets downloaded. */
const CaMonthlyPackageView = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [month, setMonth] = useState(thisMonth());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const { downloading, progress, run } = useFileDownload(authHeader);

    const fetchPackage = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/reports/ca-monthly-package`, { ...authHeader, params: { month } });
            if (res.data.success) setData(res.data.data);
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching CA monthly package'); }
        finally { setLoading(false); }
    };

    const download = () => run(
        url, '/api/finance/reports/ca-monthly-package/download', `CA-Monthly-Package-${month}.pdf`, { month }, 'Error downloading PDF'
    );

    return (
        <div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div className="add-product-name flex-col">
                    <p>Month</p>
                    <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
                </div>
                <button type="button" className="add-point-btn" disabled={loading} onClick={fetchPackage}>{loading ? 'Loading…' : 'Preview'}</button>
                {data && (
                    <DownloadButton
                        downloading={downloading} progress={progress}
                        idleLabel="Download PDF" onClick={download} className="add-point-btn"
                    />
                )}
            </div>

            {data && (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                        For handoff to your CA: computed figures, not a filed return.
                    </p>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>GST Summary</p>
                    <div className="list-table finance-table" style={{ marginBottom: '20px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <b>Output GST</b><b>Input GST</b><b>Net Payable</b>
                        </div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <p>₹{data.gst.outputGst.toLocaleString('en-IN')}</p>
                            <p>₹{data.gst.inputGst.toLocaleString('en-IN')}</p>
                            <p style={{ fontWeight: 600 }}>₹{data.gst.netGstPayable.toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>TDS Summary</p>
                    <div className="list-table finance-table" style={{ marginBottom: '20px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1fr' }}>
                            <b>Section</b><b>Amount</b>
                        </div>
                        {data.tds.bySection.length === 0 ? (
                            <div className="admin-empty-state"><p>No TDS recorded this month.</p></div>
                        ) : data.tds.bySection.map(s => (
                            <div key={s.tdsSectionId || 'unspecified'} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr' }}>
                                <p>{s.tdsSectionName}{s.tdsSectionCode ? ` (${s.tdsSectionCode})` : ''}</p>
                                <p>₹{s.totalTds.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Sales / Purchase / Expense Summary</p>
                    <div className="list-table finance-table" style={{ marginBottom: '20px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <b>Sales (Issued Bills)</b><b>Net Purchases</b><b>Expenses</b>
                        </div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <p>₹{data.sales.totalBilled.toLocaleString('en-IN')} ({data.sales.billCount})</p>
                            <p>₹{data.purchases.netPurchases.toLocaleString('en-IN')} ({data.purchases.purchaseCount})</p>
                            <p>₹{data.expenses.totalExpenses.toLocaleString('en-IN')} ({data.expenses.expenseCount})</p>
                        </div>
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Bank & Cash Position (as of month end)</p>
                    <div className="list-table finance-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1fr' }}>
                            <b>Account</b><b>Closing Balance</b>
                        </div>
                        {data.bankAndCash.bankAccounts.map(a => (
                            <div key={a.accountId} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr' }}>
                                <p>{a.accountName}</p>
                                <p>₹{a.closingBalance.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr' }}>
                            <p>Cash</p>
                            <p>₹{data.bankAndCash.cashClosingBalance.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr', fontWeight: 700 }}>
                            <p>Total Position</p>
                            <p>₹{data.bankAndCash.totalPosition.toLocaleString('en-IN')}</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CaMonthlyPackageView;
