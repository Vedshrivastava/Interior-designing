import React, { useState } from 'react';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import BankBalanceView from '../../components/finance/BankBalanceView';
import BankStatementView from '../../components/finance/BankStatementView';
import BankTransfersManager from '../../components/finance/BankTransfersManager';

const TABS = [
    { key: 'accounts',     label: 'All Accounts' },
    { key: 'balance',      label: 'Balance' },
    { key: 'transactions', label: 'Transactions / Statements' },
    { key: 'transfers',    label: 'Transfers' },
];

/* Real as of the Bank + Cash Book build. Transactions and Statements were
   two separate placeholder tabs before (Statements framed around bank-
   statement import/reconciliation, which isn't part of this build) —
   collapsed into one real tab here since both were describing the same
   computed running-balance transaction list. */
const BankPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);

    return (
        <FinanceTabShell
            label="Bank"
            subtitle="Bank accounts, balances, statements, and transfers."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'accounts' && <MasterCrudTable url={url} resourceKey="bankAccounts" />}
            {activeTab === 'balance' && <BankBalanceView url={url} />}
            {activeTab === 'transactions' && <BankStatementView url={url} />}
            {activeTab === 'transfers' && <BankTransfersManager url={url} />}
        </FinanceTabShell>
    );
};

export default BankPage;
