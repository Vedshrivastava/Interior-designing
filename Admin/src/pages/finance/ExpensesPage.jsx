import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import ExpensesManager from '../../components/finance/ExpensesManager';
import ExpenseAnalysisView from '../../components/finance/ExpenseAnalysisView';

const TABS = [
    { key: 'log',      label: 'Log' },
    { key: 'analysis', label: 'Analysis' },
];

/*
 * Dedicated top-level home for general/site expenses — previously buried
 * as a tab inside Payables with no sidebar entry of its own, which made it
 * hard to find. Same two pieces as before (raw log + category/project/
 * work/person breakdown), just given the same standing as Receivables/
 * Receipts/Payables/Payments/Bank/Cash Book. Still reachable unscoped from
 * Payments' Miscellaneous tab too, for the "make a payment now" workflow.
 *
 * ?tab=log&expenseId= supports deep-linking in from a project's own
 * Expenses tab's "Details" action — lands on the Log tab with that one
 * row scrolled to and briefly highlighted.
 */
const ExpensesPage = ({ url }) => {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || TABS[0].key);

    return (
        <FinanceTabShell
            label="Expenses"
            subtitle="General/site expenses — not tied to a vendor, contractor, or employee ledger. Paid at entry, or recorded pending and settled later."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'log' && <ExpensesManager url={url} highlightId={searchParams.get('expenseId')} />}
            {activeTab === 'analysis' && <ExpenseAnalysisView url={url} />}
        </FinanceTabShell>
    );
};

export default ExpensesPage;
