import React, { useState } from 'react';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import MasterCrudTable from '../../components/finance/MasterCrudTable';

const TABS = [
    { key: 'vendors',       label: 'Vendors' },
    { key: 'purchases',     label: 'Purchases' },
    { key: 'materialDump',  label: 'Material Dump' },
    { key: 'returns',       label: 'Returns' },
];

const NON_CONTRACTOR = (v) => v.vendorType !== 'labour_contractor';

/* Vendors here is the same financeVendor data as everywhere else, just
   client-side filtered to exclude labour_contractor vendors — those show
   up under Contractors instead. No backend change; same MasterCrudTable
   used by Masters and Contractors. */
const ProcurementPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);

    return (
        <FinanceTabShell
            label="Procurement"
            subtitle="Material vendors and purchasing — labour contractors live under Contractors instead."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'vendors' && <MasterCrudTable url={url} resourceKey="vendors" filter={NON_CONTRACTOR} />}
            {activeTab === 'purchases' && <PlaceholderTab text="Material purchase orders." phase="Phase 3" />}
            {activeTab === 'materialDump' && <PlaceholderTab text="Material dumped/delivered at site, ahead of consumption tracking." />}
            {activeTab === 'returns' && <PlaceholderTab text="Material returned to vendors." />}
        </FinanceTabShell>
    );
};

export default ProcurementPage;
