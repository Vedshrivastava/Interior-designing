import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
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

    useEffect(() => {
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader)
            .then(res => { if (res.data.success) setAccounts(res.data.data); })
            .catch(() => toast.error('Error fetching bank accounts'))
            .finally(() => setLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;
    if (accounts.length === 0) return <div className="admin-empty-state"><p>No bank accounts yet; add one under All Accounts.</p></div>;

    const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '12px' }}>Total across all accounts: ₹{totalBalance.toLocaleString('en-IN')}</p>
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr' }}>
                    <b>Account</b><b>Bank</b><b>Opening Balance</b><b>Current Balance</b>
                </div>
                {accounts.map(a => (
                    <div key={a._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1.3fr 1fr 1fr 1fr' }}>
                        <p>{a.accountName}</p>
                        <p>{a.bankName}</p>
                        <p>₹{a.openingBalance.toLocaleString('en-IN')}</p>
                        <p style={{ fontWeight: 600, color: a.currentBalance < 0 ? '#c0392b' : 'var(--moss)' }}>₹{a.currentBalance.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BankBalanceView;
