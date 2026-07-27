import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import ContractorPaymentsManager from '../../components/finance/ContractorPaymentsManager';
import VendorPaymentsManager from '../../components/finance/VendorPaymentsManager';
import SalaryPaymentsManager from '../../components/finance/SalaryPaymentsManager';
import CommissionPaymentsManager from '../../components/finance/CommissionPaymentsManager';
import LabourProviderPaymentsManager from '../../components/finance/LabourProviderPaymentsManager';
import ExpensesManager from '../../components/finance/ExpensesManager';
import TdsPayableManager from '../../components/finance/TdsPayableManager';

const TABS = [
    { key: 'vendor',     label: 'Vendor Payment' },
    { key: 'contractor', label: 'Contractor Payment' },
    { key: 'salary',     label: 'Salary' },
    { key: 'commission', label: 'Commission' },
    { key: 'labourProvider', label: 'Labour Provider' },
    { key: 'tds',        label: 'TDS Payable' },
    { key: 'misc',       label: 'Miscellaneous' },
];

const PaymentsPage = ({ url }) => {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || TABS[0].key);

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
            {activeTab === 'labourProvider' && <LabourProviderPaymentsManager url={url} />}
            {activeTab === 'tds' && <TdsPayableManager url={url} />}
            {activeTab === 'misc' && <ExpensesManager url={url} />}
        </FinanceTabShell>
    );
};

export default PaymentsPage;
