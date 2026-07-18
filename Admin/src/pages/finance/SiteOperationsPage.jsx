import React, { useState } from 'react';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import WorkMeasurementsSummary from '../../components/finance/WorkMeasurementsSummary';
import MaterialConsumptionList from '../../components/finance/MaterialConsumptionList';

const TABS = [
    { key: 'measurements', label: 'Daily Measurements' },
    { key: 'consumption',  label: 'Material Consumption' },
    { key: 'diary',        label: 'Site Diary' },
];

const SiteOperationsPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);

    return (
        <FinanceTabShell
            label="Site Operations"
            subtitle="Log daily measurements against a project's works: this drives completion %, contractor earnings, and material consumption automatically."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'measurements' && <WorkMeasurementsSummary url={url} />}
            {activeTab === 'consumption' && <MaterialConsumptionList url={url} />}
            {activeTab === 'diary' && <PlaceholderTab text="Daily site notes and issues log." />}
        </FinanceTabShell>
    );
};

export default SiteOperationsPage;
