import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const todayKey = () => new Date().toISOString().slice(0, 10);
const emptyLoanForm = { lenderName: '', principal: '', dateTaken: todayKey(), interestRate: '', paidVia: 'cash', bankAccountId: '', notes: '' };
const emptyRepaymentForm = { date: todayKey(), amount: '', interestPortion: '', paidVia: 'cash', bankAccountId: '', notes: '' };

/*
 * A loan taken by the company — lender, principal, optional interest
 * rate — with an outstanding balance that drops as repayments (below,
 * per loan) get logged. Same bank/cash convention as every other payment
 * type in this app: pick a bank account and it shows up on that
 * account's own statement; leave it as Cash and a matching Cash Book
 * entry is created automatically.
 */
const LoansManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [selectedLoanId, setSelectedLoanId] = useState('');

    const [loanModalOpen, setLoanModalOpen] = useState(false);
    const [loanForm, setLoanForm] = useState(emptyLoanForm);
    const [savingLoan, setSavingLoan] = useState(false);

    const [repayments, setRepayments] = useState([]);
    const [repaymentsLoading, setRepaymentsLoading] = useState(false);
    const [repaymentModalOpen, setRepaymentModalOpen] = useState(false);
    const [repaymentForm, setRepaymentForm] = useState(emptyRepaymentForm);
    const [savingRepayment, setSavingRepayment] = useState(false);

    const fetchLoans = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/loans/list`, authHeader);
            if (res.data.success) setLoans(res.data.data);
        } catch { toast.error('Error fetching loans'); }
        finally { setLoading(false); }
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchLoans(); }, [fetchLoans]);
    useFinanceWsRefresh(['financeLoansChanged'], fetchLoans);

    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchRepayments = useCallback(async () => {
        if (!selectedLoanId) { setRepayments([]); return; }
        setRepaymentsLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/loans/repayments/list`, { ...authHeader, params: { loanId: selectedLoanId } });
            if (res.data.success) setRepayments(res.data.data);
        } catch { toast.error('Error fetching repayments'); }
        finally { setRepaymentsLoading(false); }
    }, [url, selectedLoanId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchRepayments(); }, [fetchRepayments]);
    useFinanceWsRefresh(['financeLoansChanged'], fetchRepayments);

    const setLoanField = (key, value) => setLoanForm(prev => ({ ...prev, [key]: value }));
    const openAddLoan = () => { setLoanForm(emptyLoanForm); setLoanModalOpen(true); };

    const submitLoan = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!loanForm.lenderName.trim()) return toast.error('Lender is required');
        if (!loanForm.principal || Number(loanForm.principal) <= 0) return toast.error('A valid principal amount is required');
        if (!loanForm.dateTaken) return toast.error('Date is required');
        if (loanForm.paidVia === 'bank' && !loanForm.bankAccountId) return toast.error('Select which account this was received into');
        setSavingLoan(true);
        try {
            const res = await axios.post(`${url}/api/finance/loans/add`, {
                lenderName: loanForm.lenderName, principal: loanForm.principal, dateTaken: loanForm.dateTaken,
                interestRate: loanForm.interestRate, notes: loanForm.notes,
                bankAccountId: loanForm.paidVia === 'bank' ? loanForm.bankAccountId : undefined,
                bankOrCashLabel: loanForm.paidVia === 'bank' ? (bankAccounts.find(a => a._id === loanForm.bankAccountId)?.accountName || '') : 'Cash',
            }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setLoanModalOpen(false); await fetchLoans(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error adding loan'); }
        finally { setSavingLoan(false); }
    };

    const toggleClose = async (loan) => {
        try {
            const res = await axios.post(`${url}/api/finance/loans/close`, { _id: loan._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchLoans(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error updating loan'); }
    };

    const removeLoan = async (loan) => {
        try {
            const res = await axios.delete(`${url}/api/finance/loans/remove`, { ...authHeader, data: { _id: loan._id } });
            if (res.data.success) { toast.success(res.data.message); if (selectedLoanId === loan._id) setSelectedLoanId(''); await fetchLoans(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing loan'); }
    };

    const setRepaymentField = (key, value) => setRepaymentForm(prev => ({ ...prev, [key]: value }));
    const openAddRepayment = () => { setRepaymentForm(emptyRepaymentForm); setRepaymentModalOpen(true); };

    const submitRepayment = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!repaymentForm.amount || Number(repaymentForm.amount) <= 0) return toast.error('A valid amount is required');
        if (!repaymentForm.date) return toast.error('Date is required');
        if (repaymentForm.paidVia === 'bank' && !repaymentForm.bankAccountId) return toast.error('Select which account this was paid from');
        setSavingRepayment(true);
        try {
            const res = await axios.post(`${url}/api/finance/loans/repayments/add`, {
                loanId: selectedLoanId, date: repaymentForm.date, amount: repaymentForm.amount,
                interestPortion: repaymentForm.interestPortion, notes: repaymentForm.notes,
                bankAccountId: repaymentForm.paidVia === 'bank' ? repaymentForm.bankAccountId : undefined,
                bankOrCashLabel: repaymentForm.paidVia === 'bank' ? (bankAccounts.find(a => a._id === repaymentForm.bankAccountId)?.accountName || '') : 'Cash',
            }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setRepaymentModalOpen(false); await Promise.all([fetchRepayments(), fetchLoans()]); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording repayment'); }
        finally { setSavingRepayment(false); }
    };

    const removeRepayment = async (repayment) => {
        try {
            const res = await axios.delete(`${url}/api/finance/loans/repayments/remove`, { ...authHeader, data: { _id: repayment._id } });
            if (res.data.success) { toast.success(res.data.message); await Promise.all([fetchRepayments(), fetchLoans()]); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing repayment'); }
    };

    const selectedLoan = loans.find(l => l._id === selectedLoanId);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button type="button" className="add-btn" onClick={openAddLoan}>+ Add Loan</button>
            </div>

            {loanModalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay ln-overlay" style={{ zIndex: 100000 }}>
                    <div className="loader-modal-box edit-modal ln-modal">
                        <div className="ln-modal-header"><h2>Add Loan</h2></div>
                        <div className="ln-modal-body">
                            <form id="loan-form" onSubmit={submitLoan}>
                                <div className="wizard-field-grid">
                                    <div className="add-product-name flex-col">
                                        <p>Lender *</p>
                                        <input type="text" value={loanForm.lenderName} onChange={e => setLoanField('lenderName', e.target.value)} placeholder="Bank / person / institution" />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Principal *</p>
                                        <input type="number" min="0" step="0.01" value={loanForm.principal} onChange={e => setLoanField('principal', e.target.value)} placeholder="0.00" />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Date Taken *</p>
                                        <StyledDatePicker value={loanForm.dateTaken} onChange={v => setLoanField('dateTaken', v)} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Interest Rate % (optional, annual)</p>
                                        <input type="number" min="0" step="0.01" value={loanForm.interestRate} onChange={e => setLoanField('interestRate', e.target.value)} placeholder="e.g. 12" />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Received Via</p>
                                        <StyledSelect value={loanForm.paidVia} onChange={v => setLoanField('paidVia', v || 'cash')} options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank' }]} />
                                    </div>
                                    {loanForm.paidVia === 'bank' && (
                                        <div className="add-product-name flex-col">
                                            <p>Bank Account *</p>
                                            <StyledSelect value={loanForm.bankAccountId} onChange={v => setLoanField('bankAccountId', v)} placeholder="Select account…"
                                                options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))} />
                                        </div>
                                    )}
                                    <div className="add-product-name flex-col wizard-field-full">
                                        <p>Notes (optional)</p>
                                        <textarea rows="2" value={loanForm.notes} onChange={e => setLoanField('notes', e.target.value)} />
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="edit-modal-actions ln-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setLoanModalOpen(false)}>Cancel</button>
                            <button type="submit" form="loan-form" className="add-btn" disabled={savingLoan}>{savingLoan ? 'Saving…' : <><FontAwesomeIcon icon={faCheck} className="pq-action-icon" /> Add Loan</>}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : loans.length === 0 ? (
                <div className="admin-empty-state"><p>No loans yet.</p></div>
            ) : (
                <div className="dash-chart-card camp-line-table-card" style={{ marginBottom: '24px' }}>
                    <table className="camp-line-table">
                        <thead>
                            <tr><th>Lender</th><th>Principal</th><th>Rate</th><th>Date Taken</th><th>Outstanding</th><th>Status</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            {loans.map(loan => (
                                <tr key={loan._id} style={selectedLoanId === loan._id ? { background: 'rgba(201,168,124,0.08)' } : undefined}>
                                    <td data-label="Lender">{loan.lenderName}</td>
                                    <td data-label="Principal">₹{loan.principal.toLocaleString('en-IN')}</td>
                                    <td data-label="Rate">{loan.interestRate != null ? `${loan.interestRate}%` : '—'}</td>
                                    <td data-label="Date Taken">{new Date(loan.dateTaken).toLocaleDateString('en-IN')}</td>
                                    <td data-label="Outstanding">₹{loan.outstandingBalance.toLocaleString('en-IN')}</td>
                                    <td data-label="Status">
                                        <span className="item-category" style={{ color: loan.status === 'closed' ? 'var(--moss)' : '#b8860b' }}>
                                            {loan.status === 'closed' ? 'Closed' : 'Active'}
                                        </span>
                                    </td>
                                    <td data-label="Action">
                                        <div className="action-buttons" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                            <p onClick={() => setSelectedLoanId(selectedLoanId === loan._id ? '' : loan._id)} className="cursor edit-action">
                                                {selectedLoanId === loan._id ? 'Hide' : 'Repayments'}
                                            </p>
                                            <p onClick={() => toggleClose(loan)} className="cursor edit-action">{loan.status === 'closed' ? 'Reopen' : 'Close'}</p>
                                            <p onClick={() => removeLoan(loan)} className="cursor delete-action">X</p>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedLoan && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <p className="admin-subtitle" style={{ margin: 0 }}>Repayments — {selectedLoan.lenderName}</p>
                        <button type="button" className="add-btn" onClick={openAddRepayment}>+ Log Repayment</button>
                    </div>

                    {repaymentModalOpen && ReactDOM.createPortal(
                        <div className="submit-loader-overlay lnr-overlay" style={{ zIndex: 100000 }}>
                            <div className="loader-modal-box edit-modal lnr-modal">
                                <div className="lnr-modal-header"><h2>Log Repayment</h2></div>
                                <div className="lnr-modal-body">
                                    <form id="loan-repayment-form" onSubmit={submitRepayment}>
                                        <div className="wizard-field-grid">
                                            <div className="add-product-name flex-col">
                                                <p>Date *</p>
                                                <StyledDatePicker value={repaymentForm.date} onChange={v => setRepaymentField('date', v)} />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Amount *</p>
                                                <input type="number" min="0" step="0.01" value={repaymentForm.amount} onChange={e => setRepaymentField('amount', e.target.value)} placeholder="0.00" />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Of Which Interest (optional)</p>
                                                <input type="number" min="0" step="0.01" value={repaymentForm.interestPortion} onChange={e => setRepaymentField('interestPortion', e.target.value)} placeholder="0.00" />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Paid Via</p>
                                                <StyledSelect value={repaymentForm.paidVia} onChange={v => setRepaymentField('paidVia', v || 'cash')} options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank' }]} />
                                            </div>
                                            {repaymentForm.paidVia === 'bank' && (
                                                <div className="add-product-name flex-col">
                                                    <p>Bank Account *</p>
                                                    <StyledSelect value={repaymentForm.bankAccountId} onChange={v => setRepaymentField('bankAccountId', v)} placeholder="Select account…"
                                                        options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))} />
                                                </div>
                                            )}
                                            <div className="add-product-name flex-col wizard-field-full">
                                                <p>Notes (optional)</p>
                                                <textarea rows="2" value={repaymentForm.notes} onChange={e => setRepaymentField('notes', e.target.value)} />
                                            </div>
                                        </div>
                                    </form>
                                </div>
                                <div className="edit-modal-actions lnr-modal-footer">
                                    <button type="button" className="add-btn cancel-btn" onClick={() => setRepaymentModalOpen(false)}>Cancel</button>
                                    <button type="submit" form="loan-repayment-form" className="add-btn" disabled={savingRepayment}>{savingRepayment ? 'Saving…' : <><FontAwesomeIcon icon={faCheck} className="pq-action-icon" /> Log Repayment</>}</button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}

                    {repaymentsLoading ? (
                        <div className="admin-empty-state"><p>Loading…</p></div>
                    ) : repayments.length === 0 ? (
                        <div className="admin-empty-state"><p>No repayments logged yet.</p></div>
                    ) : (
                        <div className="dash-chart-card camp-line-table-card">
                            <table className="camp-line-table">
                                <thead>
                                    <tr><th>Date</th><th>Amount</th><th>Interest</th><th>Principal Reduced</th><th>Paid Via</th><th>Action</th></tr>
                                </thead>
                                <tbody>
                                    {repayments.map(r => (
                                        <tr key={r._id}>
                                            <td data-label="Date">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                                            <td data-label="Amount">₹{r.amount.toLocaleString('en-IN')}</td>
                                            <td data-label="Interest">{r.interestPortion > 0 ? `₹${r.interestPortion.toLocaleString('en-IN')}` : '—'}</td>
                                            <td data-label="Principal Reduced">₹{(r.amount - (r.interestPortion || 0)).toLocaleString('en-IN')}</td>
                                            <td data-label="Paid Via">{r.bankAccountId?.accountName || r.bankOrCashLabel || 'Cash'}</td>
                                            <td data-label="Action">
                                                <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                                                    <p onClick={() => removeRepayment(r)} className="cursor delete-action">X</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LoansManager;
