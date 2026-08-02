import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';

/* Current balance per account — openingBalance + computed activity, same
   currentBalance the list endpoint already decorates every account with
   (used by the "All Accounts" tab's MasterCrudTable too, just not shown
   there since that table is generic). */
const BankBalanceView = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAccounts = () => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setAccounts(res.data.data); })
            .catch(() => toast.error('Error fetching bank accounts'))
            .finally(() => setLoading(false));
    };

    useEffect(fetchAccounts, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    // Every payment/receipt/expense/transfer type that can touch a bank
    // account broadcasts this — see the controllers' cash-vs-bank branch —
    // so balances here stay live without the tab having to be reopened.
    useFinanceWsRefresh(['financeBankAccountsChanged'], fetchAccounts);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (accounts.length === 0) return <div className="admin-empty-state"><p>No bank accounts yet; add one under All Accounts.</p></div>;

    const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>Total across all accounts: ₹{totalBalance.toLocaleString('en-IN')}</p>
            <div className="dash-chart-card bkb-card">
                <div className="bkb-row bkb-header">
                    <b className="bkb-account">Account</b>
                    <b className="bkb-bank">Bank</b>
                    <b className="bkb-opening">Opening Balance</b>
                    <b className="bkb-current">Current Balance</b>
                </div>
                {accounts.map(a => (
                    <div key={a._id} className="bkb-row">
                        <p className="bkb-account">{a.accountName}</p>
                        <p className="bkb-bank"><span className="pq-group-label">Bank</span>{a.bankName}</p>
                        <p className="bkb-opening"><span className="pq-group-label">Opening Balance</span>₹{a.openingBalance.toLocaleString('en-IN')}</p>
                        <p className="bkb-current" style={{ fontWeight: 600, color: a.currentBalance < 0 ? '#c0392b' : 'var(--moss)' }}><span className="pq-group-label">Current Balance</span>₹{a.currentBalance.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BankBalanceView;
