import React from 'react';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import DailyLabourManager from '../../components/finance/DailyLabourManager';

const TABS = [{ key: 'list', label: 'All Entries' }];

/*
 * Global Daily Labour — entry form + list/filter across every project, not
 * scoped to one supervisor. Same DailyLabourManager component a project's
 * own Daily Labour tab and Supervisors' Daily Labour tab reuse, just with
 * no projectId/supervisorId passed so nothing is pre-scoped.
 */
const DailyLabourPage = ({ url }) => (
    <FinanceTabShell
        label="Daily Labour"
        subtitle="Casual/daily-wage labour, distinct from contractor teams — no separate labourer master, entries are name-only."
        tabs={TABS}
        activeKey="list"
        onTabChange={() => {}}
    >
        <DailyLabourManager url={url} />
    </FinanceTabShell>
);

export default DailyLabourPage;
