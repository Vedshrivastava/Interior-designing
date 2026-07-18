import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import ProjectProfitView from '../../components/finance/ProjectProfitView';
import ClientProfitView from '../../components/finance/ClientProfitView';
import WorkProfitView from '../../components/finance/WorkProfitView';
import ContractorAnalysisTable from '../../components/finance/ContractorAnalysisTable';
import VendorAnalysisTable from '../../components/finance/VendorAnalysisTable';
import MaterialAnalysisView from '../../components/finance/MaterialAnalysisView';
import CashFlowView from '../../components/finance/CashFlowView';
import ExpenseAnalysisView from '../../components/finance/ExpenseAnalysisView';
import CaMonthlyPackageView from '../../components/finance/CaMonthlyPackageView';

const TABS = [
    { key: 'project-profit',      label: 'Project Profit' },
    { key: 'client-profit',       label: 'Client Profit' },
    { key: 'work-profit',         label: 'Work Profit' },
    { key: 'contractor-analysis', label: 'Contractor Analysis' },
    { key: 'vendor-analysis',     label: 'Vendor Analysis' },
    { key: 'material-analysis',   label: 'Material Analysis' },
    { key: 'cash-flow',           label: 'Cash Flow' },
    { key: 'expense-analysis',    label: 'Expense Analysis' },
    { key: 'ca-monthly-package',  label: 'CA Monthly Package' },
    { key: 'supervisor-analysis', label: 'Supervisor Analysis' },
    { key: 'labour-analysis',     label: 'Labour Analysis' },
    { key: 'reconciliation',      label: 'Reconciliation' },
];

/*
 * Bespoke component — Reports is a pure rollup over data every other
 * finance module already writes; nothing here is writable. Project
 * Profit / Client Profit / Work Profit cross-link each other (a project
 * links to its client's rollup, a client's project row links back into
 * that project, and a project's own Works list — mirrored from
 * WorksManager's "Profit" action — links into Work Profit), so their
 * picker state is lifted up here rather than living inside each tab.
 *
 * Work Profit has no picker of its own by design (per the build spec) —
 * it's only ever reached by drilling in from a project's Works tab or
 * from here, both of which land via ?tab=work-profit&workId=... in the
 * URL, read once on mount below.
 */
const ReportsPage = ({ url }) => {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || TABS[0].key);
    const [projectId, setProjectId] = useState('');
    const [clientId, setClientId] = useState('');
    const [workId, setWorkId] = useState(searchParams.get('workId') || '');

    const goToClientProfit = (id) => { setClientId(id || ''); setActiveTab('client-profit'); };
    const goToProjectProfit = (id) => { setProjectId(id || ''); setActiveTab('project-profit'); };
    const goToWorkProfit = (id) => { setWorkId(id || ''); setActiveTab('work-profit'); };

    return (
        <FinanceTabShell
            label="Reports"
            subtitle="Rollups over every other module's data: read-only, computed fresh on every request. Material-cost figures use weighted-average costing (see each tab)."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'project-profit' && (
                <ProjectProfitView url={url} projectId={projectId} onSelectProject={setProjectId} onViewClientProfit={goToClientProfit} onViewWorkProfit={goToWorkProfit} />
            )}
            {activeTab === 'client-profit' && (
                <ClientProfitView url={url} clientId={clientId} onSelectClient={setClientId} onViewProjectProfit={goToProjectProfit} />
            )}
            {activeTab === 'work-profit' && <WorkProfitView url={url} workId={workId} />}
            {activeTab === 'contractor-analysis' && <ContractorAnalysisTable url={url} />}
            {activeTab === 'vendor-analysis' && <VendorAnalysisTable url={url} />}
            {activeTab === 'material-analysis' && <MaterialAnalysisView url={url} />}
            {activeTab === 'cash-flow' && <CashFlowView url={url} />}
            {activeTab === 'expense-analysis' && <ExpenseAnalysisView url={url} />}
            {activeTab === 'ca-monthly-package' && <CaMonthlyPackageView url={url} />}
            {activeTab === 'supervisor-analysis' && <PlaceholderTab text="No aggregated report built yet; see a supervisor's own Incentives/Deductions tabs for their individual numbers." />}
            {activeTab === 'labour-analysis' && <PlaceholderTab text="No aggregated report built yet; see a labourer's own ledger (via their supervisor's Roster tab) for individual numbers." />}
            {activeTab === 'reconciliation' && <PlaceholderTab text="Guided month-end checklist: approve entries, settle labour, verify stock, invoice, chase receivables, pay vendors, GST, TDS, review." phase="Phase 6" />}
        </FinanceTabShell>
    );
};

export default ReportsPage;
