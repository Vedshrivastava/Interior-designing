import React, { useState } from 'react';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import ContractorPaymentsManager from '../../components/finance/ContractorPaymentsManager';

const TABS = [
    { key: 'vendor',     label: 'Vendor Payment' },
    { key: 'contractor', label: 'Contractor Payment' },
    { key: 'salary',     label: 'Salary' },
    { key: 'commission', label: 'Commission' },
    { key: 'misc',       label: 'Miscellaneous' },
];

const PaymentsPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);

    return (
        <FinanceTabShell
            label="Payments"
            subtitle="All outgoing payments — client receipts live under Receipts instead."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'vendor' && <PlaceholderTab text="Payments made to material vendors." phase="Phase 3" />}
            {activeTab === 'contractor' && <ContractorPaymentsManager url={url} />}
            {activeTab === 'salary' && <PlaceholderTab text="Salary payouts to employees." />}
            {activeTab === 'commission' && <PlaceholderTab text="Referral commission payouts." />}
            {activeTab === 'misc' && <PlaceholderTab text="Any other outgoing payment." />}
        </FinanceTabShell>
    );
};

export default PaymentsPage;
