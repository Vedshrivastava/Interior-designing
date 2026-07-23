import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';

const DESCRIPTION_LABEL = { receipt: 'Receipt', contractorPayment: 'Contractor Payment', vendorPayment: 'Vendor Payment', transfer: 'Transfer' };

/* Running-balance transaction list for one account — opening balance +
   every receipt/contractor-payment/vendor-payment/transfer linked to it,
   in chronological order. Covers both the "Transactions" and "Statements"
   tabs, since they're the same computed view. */
const BankStatementView = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [statement, setStatement] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchAccounts = () => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader).then(res => { if (res.data.success) setAccounts(res.data.data); }).catch(() => {});
    };
    useEffect(fetchAccounts, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchStatement = () => {
        if (!selectedAccountId) { setStatement(null); return; }
        setLoading(true);
        axios.get(`${url}/api/finance/bank-accounts/${selectedAccountId}/statement`, authHeader)
            .then(res => { if (res.data.success) setStatement(res.data.data); else toast.error(res.data.message); })
            .catch(() => toast.error('Error fetching statement'))
            .finally(() => setLoading(false));
    };
    useEffect(fetchStatement, [url, selectedAccountId]); // eslint-disable-line react-hooks/exhaustive-deps
    // Same event every payment/receipt/expense/transfer type broadcasts when
    // it touches a bank account (see BankBalanceView's identical comment).
    useFinanceWsRefresh(['financeBankAccountsChanged'], () => { fetchAccounts(); fetchStatement(); });

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Account</p>
                <StyledSelect
                    value={selectedAccountId} onChange={setSelectedAccountId} placeholder="Select account…"
                    options={accounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                />
            </div>

            {!selectedAccountId ? (
                <div className="admin-empty-state"><p>Select an account to view its statement.</p></div>
            ) : loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : !statement ? (
                <div className="admin-empty-state"><p>Unable to load statement.</p></div>
            ) : (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '12px' }}>
                        Opening ₹{statement.openingBalance.toLocaleString('en-IN')} (as of {new Date(statement.openingBalanceDate).toLocaleDateString()}) · Current ₹{statement.currentBalance.toLocaleString('en-IN')}
                    </p>
                    <div className="list-table finance-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                            <b>Date</b><b>Description</b><b>Credit</b><b>Debit</b><b>Balance</b>
                        </div>
                        {statement.transactions.length === 0 ? (
                            <div className="admin-empty-state"><p>No transactions yet.</p></div>
                        ) : (
                            statement.transactions.map((t, i) => (
                                <div key={i} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                                    <p>{new Date(t.date).toLocaleDateString()}</p>
                                    <p>{DESCRIPTION_LABEL[t.sourceType] || t.description}</p>
                                    <p style={{ color: 'var(--moss)' }}>{t.direction === 'credit' ? `₹${t.amount.toLocaleString('en-IN')}` : '-'}</p>
                                    <p style={{ color: '#c0392b' }}>{t.direction === 'debit' ? `₹${t.amount.toLocaleString('en-IN')}` : '-'}</p>
                                    <p style={{ fontWeight: 600 }}>₹{t.runningBalance.toLocaleString('en-IN')}</p>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default BankStatementView;
