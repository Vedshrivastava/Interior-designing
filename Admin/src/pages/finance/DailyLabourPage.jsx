import React from 'react';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import LabourMeasurementsManager from '../../components/finance/LabourMeasurementsManager';

const TABS = [{ key: 'list', label: 'All Entries' }];

/*
 * Global Labour Measurements — entry form + list/filter across every
 * project, not scoped to one supervisor. Same LabourMeasurementsManager
 * component a project's own Labour tab reuses, just with no projectId
 * passed so nothing is pre-scoped (a project picker is shown first).
 */
const DailyLabourPage = ({ url }) => (
    <FinanceTabShell
        label="Labour Measurements"
        subtitle="Daily per-labourer area logged against a Work — each labourer is hired directly and paid per sqft, not a day rate."
        tabs={TABS}
        activeKey="list"
        onTabChange={() => {}}
    >
        <LabourMeasurementsManager url={url} />
    </FinanceTabShell>
);

export default DailyLabourPage;
