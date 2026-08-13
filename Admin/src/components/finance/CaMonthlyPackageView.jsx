import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFileDownload } from '../../hooks/useFileDownload';
import DownloadButton from './DownloadButton';
import StyledMonthPicker from './StyledMonthPicker';
import StyledDatePicker from './StyledDatePicker';
import { KpiCard, KpiGrid } from './DashboardWidgets';
import '../../styles/list.css';
import '../../styles/add.css';
import '../../styles/wizard.css';
import '../../styles/dashboard.css';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN');
const fmtMoney = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

/* Generic line-item table — every new detail section below (TDS
   payments/deposits, bills, purchases, expenses, bank/cash transactions)
   is the same shape (a header row + N data rows), so one renderer covers
   all of them instead of a bespoke CSS grid per section. This is a
   preview surface, not the deliverable itself (the PDF is what actually
   gets handed to the CA), but up to 10 columns (Purchases) as a plain
   horizontally-scrolling table read badly on mobile — nothing past
   Date/Vendor visible without sideways scrolling. camp-line-table (CSS,
   dashboard.css) collapses each row into its own labeled card below 641px
   — data-label carries each column's own label into a ::before on its
   cell, same "collapse to a labeled stack" pattern camp-tds-/camp-bank-
   already use elsewhere on this same page, just generic enough to cover
   every column shape here instead of a bespoke grid per table. */
// tableClassName is an escape hatch for one table (Bank & Cash Movement's
// transactions — see its own call site) whose 6 columns read better as a
// small 2-column receipt-style card than a flat label:value stack once
// there are a dozen-plus rows to scroll through — camp-bank-txn-table
// (CSS) repositions those 6 cells by nth-child instead of using the
// generic camp-line-table stacking for just that one table.
const LineItemTable = ({ columns, rows, emptyText, tableClassName = '' }) => (
    rows.length === 0 ? (
        <div className="admin-empty-state"><p>{emptyText}</p></div>
    ) : (
        <div className="dash-chart-card camp-line-table-card" style={{ padding: 0 }}>
            <table className={`camp-line-table ${tableClassName}`.trim()}>
                <thead>
                    <tr>
                        {columns.map(c => (
                            <th key={c.key} style={{ textAlign: c.align || 'left' }}>{c.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i}>
                            {columns.map(c => (
                                <td key={c.key} data-label={c.label} style={{ textAlign: c.align || 'left' }}>
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
const emptyFilingForm = { gstPayable: '', gstClaimable: '', taxPaid: '', filedDate: '', notes: '' };

const CaMonthlyPackageView = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [month, setMonth] = useState(thisMonth());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const { downloading, progress, run } = useFileDownload(authHeader);

    const [filingForm, setFilingForm] = useState(emptyFilingForm);
    const [savingFiling, setSavingFiling] = useState(false);

    const fetchPackage = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/reports/ca-monthly-package`, { ...authHeader, params: { month } });
            if (res.data.success) {
                setData(res.data.data);
                // Prefill the "As Filed" form from whatever's currently in
                // effect for this month — the CA's real filing if one
                // exists, otherwise blank (nothing to edit, only to add).
                setFilingForm(res.data.data.gst.isFiled ? {
                    gstPayable: res.data.data.gst.netGstPayable, gstClaimable: res.data.data.gst.itcCarriedForward,
                    taxPaid: res.data.data.gst.taxPaid, filedDate: res.data.data.gst.filedDate ? res.data.data.gst.filedDate.slice(0, 10) : '',
                    notes: '',
                } : emptyFilingForm);
            }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching CA monthly package'); }
        finally { setLoading(false); }
    };

    const setFilingField = (key, value) => setFilingForm(prev => ({ ...prev, [key]: value }));

    const saveFiling = async () => {
        setSavingFiling(true);
        try {
            const res = await axios.post(`${url}/api/finance/gst-filings/save`, { ...filingForm, month }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchPackage(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error saving GST filing'); }
        finally { setSavingFiling(false); }
    };

    const clearFiling = async () => {
        if (!data?.gst?.filingId) return;
        setSavingFiling(true);
        try {
            const res = await axios.delete(`${url}/api/finance/gst-filings/remove`, { ...authHeader, data: { _id: data.gst.filingId } });
            if (res.data.success) { toast.success(res.data.message); setFilingForm(emptyFilingForm); await fetchPackage(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing GST filing'); }
        finally { setSavingFiling(false); }
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
                    <p style={{ margin: '6px 0 16px', fontSize: '0.8rem', color: data.gst.isFiled ? 'var(--moss)' : 'var(--text-lt)' }}>
                        {data.gst.isFiled
                            ? `As filed with the CA${data.gst.filedDate ? ` on ${fmtDate(data.gst.filedDate)}` : ''} — figures above are the actual filed numbers, not computed estimates.`
                            : 'Figures above are computed estimates — enter the CA’s actual filed numbers below once known.'}
                    </p>

                    <div className="dash-chart-card" style={{ padding: '16px', marginBottom: '24px' }}>
                        <p className="wizard-section-label" style={{ marginBottom: '10px' }}>As Filed (Actual) — {month}</p>
                        <div className="wizard-field-grid">
                            <div className="add-product-name flex-col">
                                <p>GST Payable (₹)</p>
                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={filingForm.gstPayable} onChange={e => setFilingField('gstPayable', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>GST Claimable / ITC Carried Forward (₹)</p>
                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={filingForm.gstClaimable} onChange={e => setFilingField('gstClaimable', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Tax Paid — Income/Advance Tax (₹)</p>
                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={filingForm.taxPaid} onChange={e => setFilingField('taxPaid', e.target.value)} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Filed Date</p>
                                <StyledDatePicker value={filingForm.filedDate} onChange={v => setFilingField('filedDate', v)} />
                            </div>
                            <div className="add-product-name flex-col wizard-field-full">
                                <p>Notes</p>
                                <input type="text" value={filingForm.notes} onChange={e => setFilingField('notes', e.target.value)} placeholder="e.g. GSTR-3B ARN, adjustments made by the CA" />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                            <button type="button" className="add-point-btn" disabled={savingFiling} onClick={saveFiling}>{savingFiling ? 'Saving…' : 'Save Filing'}</button>
                            {data.gst.isFiled && (
                                <button type="button" className="add-point-btn" style={{ background: 'transparent', color: 'var(--text-lt)', border: '1px solid rgba(154,142,132,0.4)' }} disabled={savingFiling} onClick={clearFiling}>Revert to Estimate</button>
                            )}
                        </div>
                    </div>

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
                                { key: 'bankDetails', label: 'Bank Details', render: r => r.bankDetails.split('\n').join(' — ') },
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

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Contractor &amp; Labour Payables</p>
                    <p style={{ marginBottom: '10px', fontSize: '0.8rem', color: 'var(--text-lt)' }}>
                        All-time running balance still owed for work already done — not scoped to this month. Payments actually made this month are in TDS Withheld above and Bank &amp; Cash Movement below.
                    </p>
                    <KpiGrid>
                        <KpiCard label="Outstanding Payable — Contractors (all-time)" value={fmtMoney(data.payables.contractors)} />
                        <KpiCard label="Outstanding Payable — Labour (all-time)" value={fmtMoney(data.payables.labour)} />
                    </KpiGrid>

                    <p className="admin-subtitle" style={{ margin: '24px 0 10px' }}>Sales / Purchase / Expense Summary</p>
                    <p style={{ marginBottom: '10px', fontSize: '0.8rem', color: 'var(--text-lt)' }}>
                        Net Purchases is accrual — includes purchases not yet paid to the vendor. It will not match vendor-payment debits on the bank statement 1:1; see Outstanding Payable — Vendors below for what remains unpaid.
                    </p>
                    <KpiGrid>
                        <KpiCard label="Sales (Issued Bills)" value={fmtMoney(data.sales.totalBilled)} sub={`${data.sales.billCount} bill${data.sales.billCount === 1 ? '' : 's'}`} />
                        <KpiCard label="Net Purchases" value={fmtMoney(data.purchases.netPurchases)} sub={`${data.purchases.purchaseCount} purchase${data.purchases.purchaseCount === 1 ? '' : 's'}`} />
                        <KpiCard label="Outstanding Payable — Vendors (all-time)" value={fmtMoney(data.payables.vendors)} />
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
                                { key: 'clientBankDetails', label: 'Bank Details', render: r => r.clientBankDetails.split('\n').join(' — ') },
                                { key: 'subtotal', label: 'Subtotal', align: 'right', render: r => fmtMoney(r.subtotal) },
                                { key: 'gstAmount', label: 'GST', align: 'right', render: r => fmtMoney(r.gstAmount) },
                                { key: 'total', label: 'Total', align: 'right', render: r => fmtMoney(r.total) },
                            ]}
                            rows={data.sales.bills}
                        />
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>HSN/SAC Summary — Sales</p>
                    <div style={{ marginBottom: '20px' }}>
                        <LineItemTable
                            emptyText="No sales this month."
                            columns={[
                                { key: 'sacCode', label: 'SAC Code' },
                                { key: 'taxableValue', label: 'Taxable Value', align: 'right', render: r => fmtMoney(r.taxableValue) },
                                { key: 'gstAmount', label: 'GST Amount', align: 'right', render: r => fmtMoney(r.gstAmount) },
                                { key: 'total', label: 'Total', align: 'right', render: r => fmtMoney(r.total) },
                            ]}
                            rows={data.sales.sacSummary}
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
                                { key: 'vendorBankDetails', label: 'Bank Details', render: r => r.vendorBankDetails.split('\n').join(' — ') },
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

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>HSN/SAC Summary — Purchases</p>
                    <div style={{ marginBottom: '20px' }}>
                        <LineItemTable
                            emptyText="No purchases this month."
                            columns={[
                                { key: 'hsnCode', label: 'HSN Code' },
                                { key: 'quantity', label: 'Quantity', align: 'right' },
                                { key: 'taxableValue', label: 'Taxable Value', align: 'right', render: r => fmtMoney(r.taxableValue) },
                                { key: 'gstAmount', label: 'GST Amount', align: 'right', render: r => fmtMoney(r.gstAmount) },
                            ]}
                            rows={data.purchases.hsnSummary}
                        />
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Expenses</p>
                    <div style={{ marginBottom: '20px' }}>
                        <LineItemTable
                            emptyText="No expenses recorded this month."
                            columns={[
                                { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
                                { key: 'category', label: 'Category' },
                                { key: 'partyName', label: 'Party' },
                                { key: 'partyBankDetails', label: 'Bank Details', render: r => r.partyBankDetails.split('\n').join(' — ') },
                                { key: 'amount', label: 'Amount', align: 'right', render: r => fmtMoney(r.amount) },
                                { key: 'gstAmount', label: 'GST', align: 'right', render: r => fmtMoney(r.gstAmount) },
                                { key: 'paidFrom', label: 'Paid From', render: r => r.paidFrom.split('\n').join(' — ') },
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
                                <p className="camp-bank-account">
                                    <span className="pq-group-label">Account</span>{a.accountName}
                                    <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-lt)' }}>{a.bankName} — A/C {a.accountNumber}</span>
                                </p>
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
                            <p className="admin-subtitle" style={{ marginBottom: '10px' }}>{a.accountName} — {a.bankName} — A/C {a.accountNumber} — Transactions</p>
                            <LineItemTable
                                emptyText="No transactions this month."
                                tableClassName="camp-bank-txn-table"
                                columns={[
                                    { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
                                    { key: 'description', label: 'Description' },
                                    { key: 'bankDetails', label: 'Bank Details', render: r => r.bankDetails.split('\n').join(' — ') },
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
                            tableClassName="camp-cash-txn-table"
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

                    {data.bankAndCash.ownerInvestment.allTime > 0 && (
                        <>
                            <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Owner Investment</p>
                            <p style={{ marginBottom: '10px', fontSize: '0.8rem', color: 'var(--text-lt)' }}>
                                Capital the owner put into the business — called out separately since it isn&apos;t revenue.
                            </p>
                            <KpiGrid>
                                <KpiCard label="This Month" value={fmtMoney(data.bankAndCash.ownerInvestment.thisMonth)} />
                                <KpiCard label="Cumulative (All-Time, Through This Month)" value={fmtMoney(data.bankAndCash.ownerInvestment.allTime)} />
                            </KpiGrid>
                            <div style={{ margin: '12px 0 20px' }}>
                                <LineItemTable
                                    emptyText="No owner investment this month."
                                    columns={[
                                        { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
                                        { key: 'bankAccountName', label: 'Account' },
                                        { key: 'reason', label: 'Reason' },
                                        { key: 'amount', label: 'Amount', align: 'right', render: r => fmtMoney(r.amount) },
                                    ]}
                                    rows={data.bankAndCash.ownerInvestment.rows}
                                />
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default CaMonthlyPackageView;
