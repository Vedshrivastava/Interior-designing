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
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN');
const fmtMoney = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

/* Generic line-item table — every new detail section below (TDS
   payments/deposits, bills, purchases, expenses, bank/cash transactions)
   is the same shape (a header row + N data rows), so one renderer covers
   all of them instead of a bespoke CSS grid per section. This is a
   preview surface, not the deliverable itself (the PDF is what actually
   gets handed to the CA) — a plain scrollable HTML table keeps this
   section lightweight while still showing every row the PDF shows. */
const LineItemTable = ({ columns, rows, emptyText }) => (
    rows.length === 0 ? (
        <div className="admin-empty-state"><p>{emptyText}</p></div>
    ) : (
        <div className="dash-chart-card" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                    <tr>
                        {columns.map(c => (
                            <th key={c.key} style={{
                                textAlign: c.align || 'left', padding: '10px 14px', whiteSpace: 'nowrap',
                                borderBottom: '1px solid rgba(201,168,124,0.25)', fontSize: '0.7rem',
                                textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-lt)',
                            }}>{c.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i}>
                            {columns.map(c => (
                                <td key={c.key} style={{ textAlign: c.align || 'left', padding: '8px 14px', borderBottom: '1px solid rgba(201,168,124,0.12)', whiteSpace: 'nowrap' }}>
                                    {c.render ? c.render(r) : r[c.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
);

/* Month picker + preview of every number that lands in the downloadable
   PDF — the JSON preview and the PDF come from the exact same backend
   computation (computeCaMonthlyPackage), so what's shown here is always
   what gets downloaded, right down to the same line-item detail (every
   bill, purchase, expense, TDS deduction/deposit, and bank/cash
   transaction) so nothing in the PDF needs separate explanation. */
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
                        For handoff to your CA: computed figures, not a filed return. Every total below has its own line-item detail — bills, purchases, expenses, TDS deductions/deposits, and bank/cash transactions — so it can be tallied directly against your bank statement and filings.
                    </p>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>GST Summary</p>
                    <KpiGrid>
                        <KpiCard label="ITC Brought Forward" value={fmtMoney(data.gst.itcBroughtForward)} />
                        <KpiCard label="Output GST (this month)" value={fmtMoney(data.gst.outputGst)} />
                        <KpiCard label="Input GST — Purchases (this month)" value={fmtMoney(data.gst.purchaseGst)} />
                        <KpiCard label="Input GST — Expenses (this month)" value={fmtMoney(data.gst.expenseGst)} />
                        <KpiCard label="Total Credit Available" value={fmtMoney(data.gst.availableCredit)} />
                        <KpiCard label="Net Payable" value={fmtMoney(data.gst.netGstPayable)}
                            sub={data.gst.netGstPayable === 0 && data.gst.itcCarriedForward > 0 ? `ITC Carried Forward: ${fmtMoney(data.gst.itcCarriedForward)}` : undefined} />
                    </KpiGrid>

                    <p className="admin-subtitle" style={{ margin: '24px 0 10px' }}>TDS Summary</p>
                    <KpiGrid>
                        <KpiCard label="Total TDS Withheld" value={fmtMoney(data.tds.totalTds)} />
                        <KpiCard label="Total TDS Deposited" value={fmtMoney(data.tds.totalDeposited)} />
                        <KpiCard label="Payable (withheld − deposited, this month)" value={fmtMoney(data.tds.totalTds - data.tds.totalDeposited)} />
                    </KpiGrid>
                    <div className="dash-chart-card camp-tds-card" style={{ margin: '12px 0 20px' }}>
                        <div className="camp-tds-row camp-tds-header">
                            <b className="camp-tds-section">Section</b>
                            <b className="camp-tds-amount">Amount</b>
                        </div>
                        {data.tds.bySection.length === 0 ? (
                            <div className="admin-empty-state"><p>No TDS recorded this month.</p></div>
                        ) : data.tds.bySection.map(s => (
                            <div key={s.tdsSectionId || 'unspecified'} className="camp-tds-row">
                                <p className="camp-tds-section">{s.tdsSectionName}{s.tdsSectionCode ? ` (${s.tdsSectionCode})` : ''}</p>
                                <p className="camp-tds-amount">{fmtMoney(s.totalTds)}</p>
                            </div>
                        ))}
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>TDS Withheld — Deductee-wise</p>
                    <div style={{ marginBottom: '20px' }}>
                        <LineItemTable
                            emptyText="No TDS withheld this month."
                            columns={[
                                { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
                                { key: 'partyName', label: 'Party' },
                                { key: 'partyType', label: 'Type' },
                                { key: 'section', label: 'Section', render: r => `${r.sectionName}${r.sectionCode ? ` (${r.sectionCode})` : ''}` },
                                { key: 'grossAmount', label: 'Gross Amount', align: 'right', render: r => fmtMoney(r.grossAmount) },
                                { key: 'tdsAmount', label: 'TDS', align: 'right', render: r => fmtMoney(r.tdsAmount) },
                            ]}
                            rows={data.tds.payments}
                        />
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>TDS Deposits Made (Challans)</p>
                    <div style={{ marginBottom: '20px' }}>
                        <LineItemTable
                            emptyText="No TDS deposited this month."
                            columns={[
                                { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
                                { key: 'challanNumber', label: 'Challan No.' },
                                { key: 'sectionName', label: 'Section' },
                                { key: 'accountName', label: 'Paid From' },
                                { key: 'amount', label: 'Amount', align: 'right', render: r => fmtMoney(r.amount) },
                            ]}
                            rows={data.tds.deposits}
                        />
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Sales / Purchase / Expense Summary</p>
                    <KpiGrid>
                        <KpiCard label="Sales (Issued Bills)" value={fmtMoney(data.sales.totalBilled)} sub={`${data.sales.billCount} bill${data.sales.billCount === 1 ? '' : 's'}`} />
                        <KpiCard label="Net Purchases" value={fmtMoney(data.purchases.netPurchases)} sub={`${data.purchases.purchaseCount} purchase${data.purchases.purchaseCount === 1 ? '' : 's'}`} />
                        <KpiCard label="Expenses" value={fmtMoney(data.expenses.totalExpenses)} sub={`${data.expenses.expenseCount} expense${data.expenses.expenseCount === 1 ? '' : 's'}`} />
                    </KpiGrid>

                    <p className="admin-subtitle" style={{ margin: '20px 0 10px' }}>Bills Issued</p>
                    <div style={{ marginBottom: '20px' }}>
                        <LineItemTable
                            emptyText="No bills issued this month."
                            columns={[
                                { key: 'billNumber', label: 'Bill #' },
                                { key: 'billDate', label: 'Date', render: r => fmtDate(r.billDate) },
                                { key: 'projectName', label: 'Project' },
                                { key: 'clientName', label: 'Client' },
                                { key: 'clientGstin', label: 'Client GSTIN' },
                                { key: 'subtotal', label: 'Subtotal', align: 'right', render: r => fmtMoney(r.subtotal) },
                                { key: 'gstAmount', label: 'GST', align: 'right', render: r => fmtMoney(r.gstAmount) },
                                { key: 'total', label: 'Total', align: 'right', render: r => fmtMoney(r.total) },
                            ]}
                            rows={data.sales.bills}
                        />
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Purchases &amp; Returns</p>
                    <div style={{ marginBottom: '20px' }}>
                        <LineItemTable
                            emptyText="No purchases or returns this month."
                            columns={[
                                { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
                                { key: 'vendorName', label: 'Vendor' },
                                { key: 'vendorGstin', label: 'Vendor GSTIN' },
                                { key: 'materialName', label: 'Material' },
                                { key: 'transactionType', label: 'Type', render: r => (r.transactionType === 'return' ? 'Return' : 'Purchase') },
                                { key: 'quantity', label: 'Qty', align: 'right' },
                                { key: 'ratePerUnit', label: 'Rate', align: 'right', render: r => fmtMoney(r.ratePerUnit) },
                                { key: 'totalAmount', label: 'Amount', align: 'right', render: r => fmtMoney(r.totalAmount) },
                                { key: 'gstAmount', label: 'GST', align: 'right', render: r => fmtMoney(r.gstAmount) },
                            ]}
                            rows={data.purchases.rows}
                        />
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Expenses</p>
                    <div style={{ marginBottom: '20px' }}>
                        <LineItemTable
                            emptyText="No expenses recorded this month."
                            columns={[
                                { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
                                { key: 'category', label: 'Category' },
                                { key: 'amount', label: 'Amount', align: 'right', render: r => fmtMoney(r.amount) },
                                { key: 'gstAmount', label: 'GST', align: 'right', render: r => fmtMoney(r.gstAmount) },
                            ]}
                            rows={data.expenses.rows}
                        />
                    </div>

                    <p className="admin-subtitle" style={{ margin: '24px 0 10px' }}>Bank & Cash Movement</p>
                    <div className="dash-chart-card camp-bank-card">
                        <div className="camp-bank-row camp-bank-header">
                            <b className="camp-bank-account">Account</b>
                            <b className="camp-bank-opening">Opening</b>
                            <b className="camp-bank-in">Credits</b>
                            <b className="camp-bank-out">Debits</b>
                            <b className="camp-bank-balance">Closing</b>
                        </div>
                        {data.bankAndCash.bankAccounts.map(a => (
                            <div key={a.accountId} className="camp-bank-row">
                                <p className="camp-bank-account"><span className="pq-group-label">Account</span>{a.accountName}</p>
                                <p className="camp-bank-opening"><span className="pq-group-label">Opening</span>{fmtMoney(a.openingBalance)}</p>
                                <p className="camp-bank-in"><span className="pq-group-label">Credits</span>{fmtMoney(a.creditTotal)}</p>
                                <p className="camp-bank-out"><span className="pq-group-label">Debits</span>{fmtMoney(a.debitTotal)}</p>
                                <p className="camp-bank-balance"><span className="pq-group-label">Closing</span>{fmtMoney(a.closingBalance)}</p>
                            </div>
                        ))}
                        <div className="camp-bank-row">
                            <p className="camp-bank-account"><span className="pq-group-label">Account</span>Cash</p>
                            <p className="camp-bank-opening"><span className="pq-group-label">Opening</span>{fmtMoney(data.bankAndCash.cashOpeningBalance)}</p>
                            <p className="camp-bank-in"><span className="pq-group-label">Credits</span>{fmtMoney(data.bankAndCash.cashInTotal)}</p>
                            <p className="camp-bank-out"><span className="pq-group-label">Debits</span>{fmtMoney(data.bankAndCash.cashOutTotal)}</p>
                            <p className="camp-bank-balance"><span className="pq-group-label">Closing</span>{fmtMoney(data.bankAndCash.cashClosingBalance)}</p>
                        </div>
                        <div className="camp-bank-row" style={{ fontWeight: 700 }}>
                            <p className="camp-bank-account">Total Position (month end)</p>
                            <p className="camp-bank-opening" />
                            <p className="camp-bank-in" />
                            <p className="camp-bank-out" />
                            <p className="camp-bank-balance"><span className="pq-group-label">Total</span>{fmtMoney(data.bankAndCash.totalPosition)}</p>
                        </div>
                    </div>

                    {data.bankAndCash.bankAccounts.map(a => (
                        <div key={a.accountId} style={{ marginTop: '16px' }}>
                            <p className="admin-subtitle" style={{ marginBottom: '10px' }}>{a.accountName} — Transactions</p>
                            <LineItemTable
                                emptyText="No transactions this month."
                                columns={[
                                    { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
                                    { key: 'description', label: 'Description' },
                                    { key: 'direction', label: 'Direction', render: r => (r.direction === 'credit' ? 'In' : 'Out') },
                                    { key: 'amount', label: 'Amount', align: 'right', render: r => fmtMoney(r.amount) },
                                    { key: 'runningBalance', label: 'Running Balance', align: 'right', render: r => fmtMoney(r.runningBalance) },
                                ]}
                                rows={a.transactions}
                            />
                        </div>
                    ))}
                    <div style={{ marginTop: '16px', marginBottom: '20px' }}>
                        <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Cash — Transactions</p>
                        <LineItemTable
                            emptyText="No cash transactions this month."
                            columns={[
                                { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
                                { key: 'description', label: 'Description' },
                                { key: 'direction', label: 'Direction', render: r => (r.direction === 'credit' ? 'In' : 'Out') },
                                { key: 'amount', label: 'Amount', align: 'right', render: r => fmtMoney(r.amount) },
                                { key: 'runningBalance', label: 'Running Balance', align: 'right', render: r => fmtMoney(r.runningBalance) },
                            ]}
                            rows={data.bankAndCash.cashTransactions}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default CaMonthlyPackageView;
