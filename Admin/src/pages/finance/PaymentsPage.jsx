import React, { useState } from 'react';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import ContractorPaymentsManager from '../../components/finance/ContractorPaymentsManager';
import VendorPaymentsManager from '../../components/finance/VendorPaymentsManager';
import SalaryPaymentsManager from '../../components/finance/SalaryPaymentsManager';
import CommissionPaymentsManager from '../../components/finance/CommissionPaymentsManager';
import ExpensesManager from '../../components/finance/ExpensesManager';

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
            subtitle="All outgoing payments; client receipts live under Receipts instead."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'vendor' && <VendorPaymentsManager url={url} />}
            {activeTab === 'contractor' && <ContractorPaymentsManager url={url} />}
            {activeTab === 'salary' && <SalaryPaymentsManager url={url} />}
            {activeTab === 'commission' && <CommissionPaymentsManager url={url} />}
            {activeTab === 'misc' && <ExpensesManager url={url} />}
        </FinanceTabShell>
    );
};

export default PaymentsPage;
