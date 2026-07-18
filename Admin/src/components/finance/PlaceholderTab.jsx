import React from 'react';

/* "Not built yet" filler for placeholder tabs — same visual treatment as
   the original FinancePage's default empty state, factored out so bespoke
   pages (Procurement, Contractors, Clients detail) can drop it into any
   still-unbuilt tab without re-implementing the markup. */
const PlaceholderTab = ({ text, phase }) => (
  <div className="admin-empty-state">
    <p>{text || "This section isn't built yet; it's on the roadmap."}</p>
    {phase && <p style={{ marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-lt)' }}>{phase} (coming soon)</p>}
  </div>
);

export default PlaceholderTab;
