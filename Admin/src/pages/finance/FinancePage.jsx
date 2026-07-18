import React, { useState } from 'react';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import PlaceholderTab from '../../components/finance/PlaceholderTab';

/*
 * Generic shell for every nav-only Finance page — one route with N tabs
 * instead of N separate routes, rendered off FINANCE_NAV_SECTIONS' `tabs`
 * metadata. See FinanceTabShell for the shared header/pill markup.
 */
const FinancePage = ({ label, phase, tabs = [] }) => {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);
  const active = tabs.find(t => t.key === activeKey) || tabs[0];

  return (
    <FinanceTabShell
      label={label}
      subtitle={tabs.length > 1 ? 'Select a tab below.' : "This section isn't built yet; it's on the roadmap."}
      badge={phase && `${phase} (coming soon)`}
      tabs={tabs}
      activeKey={activeKey}
      onTabChange={setActiveKey}
    >
      <PlaceholderTab text={active?.description} phase={active?.phase} />
    </FinanceTabShell>
  );
};

export default FinancePage;
