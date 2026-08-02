import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFileDownload } from '../../hooks/useFileDownload';
import DownloadButton from './DownloadButton';
import StyledMonthPicker from './StyledMonthPicker';
import { KpiCard, KpiGrid } from './DashboardWidgets';
import '../../styles/list.css';
import '../../styles/add.css';

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
                    <StyledMonthPicker value={month} onChange={v => setMonth(v || thisMonth())} />
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
                    <KpiGrid>
                        <KpiCard label="Output GST" value={`₹${data.gst.outputGst.toLocaleString('en-IN')}`} />
                        <KpiCard label="Input GST — Purchases" value={`₹${data.gst.purchaseGst.toLocaleString('en-IN')}`} />
                        <KpiCard label="Input GST — Expenses" value={`₹${data.gst.expenseGst.toLocaleString('en-IN')}`} />
                        <KpiCard label="Total Input GST" value={`₹${data.gst.inputGst.toLocaleString('en-IN')}`} />
                        <KpiCard label="Net Payable" value={`₹${data.gst.netGstPayable.toLocaleString('en-IN')}`} />
                    </KpiGrid>

                    <p className="admin-subtitle" style={{ margin: '24px 0 10px' }}>TDS Summary</p>
                    <div className="dash-chart-card camp-tds-card" style={{ marginBottom: '20px' }}>
                        <div className="camp-tds-row camp-tds-header">
                            <b className="camp-tds-section">Section</b>
                            <b className="camp-tds-amount">Amount</b>
                        </div>
                        {data.tds.bySection.length === 0 ? (
                            <div className="admin-empty-state"><p>No TDS recorded this month.</p></div>
                        ) : data.tds.bySection.map(s => (
                            <div key={s.tdsSectionId || 'unspecified'} className="camp-tds-row">
                                <p className="camp-tds-section">{s.tdsSectionName}{s.tdsSectionCode ? ` (${s.tdsSectionCode})` : ''}</p>
                                <p className="camp-tds-amount">₹{s.totalTds.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Sales / Purchase / Expense Summary</p>
                    <KpiGrid>
                        <KpiCard label="Sales (Issued Bills)" value={`₹${data.sales.totalBilled.toLocaleString('en-IN')}`} sub={`${data.sales.billCount} bill${data.sales.billCount === 1 ? '' : 's'}`} />
                        <KpiCard label="Net Purchases" value={`₹${data.purchases.netPurchases.toLocaleString('en-IN')}`} sub={`${data.purchases.purchaseCount} purchase${data.purchases.purchaseCount === 1 ? '' : 's'}`} />
                        <KpiCard label="Expenses" value={`₹${data.expenses.totalExpenses.toLocaleString('en-IN')}`} sub={`${data.expenses.expenseCount} expense${data.expenses.expenseCount === 1 ? '' : 's'}`} />
                    </KpiGrid>

                    <p className="admin-subtitle" style={{ margin: '24px 0 10px' }}>Bank & Cash Position (as of month end)</p>
                    <div className="dash-chart-card camp-bank-card">
                        <div className="camp-bank-row camp-bank-header">
                            <b className="camp-bank-account">Account</b>
                            <b className="camp-bank-balance">Closing Balance</b>
                        </div>
                        {data.bankAndCash.bankAccounts.map(a => (
                            <div key={a.accountId} className="camp-bank-row">
                                <p className="camp-bank-account">{a.accountName}</p>
                                <p className="camp-bank-balance">₹{a.closingBalance.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                        <div className="camp-bank-row">
                            <p className="camp-bank-account">Cash</p>
                            <p className="camp-bank-balance">₹{data.bankAndCash.cashClosingBalance.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="camp-bank-row" style={{ fontWeight: 700 }}>
                            <p className="camp-bank-account">Total Position</p>
                            <p className="camp-bank-balance">₹{data.bankAndCash.totalPosition.toLocaleString('en-IN')}</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CaMonthlyPackageView;
