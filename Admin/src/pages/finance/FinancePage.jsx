import React, { useState } from 'react';
import '../../styles/list.css';

/*
 * Generic shell for every Finance page — same header + category-pill
 * pattern as ListDesigns ('.admin-category-scroll' / '.admin-cat-pill').
 * Each Finance page is one route with N tabs instead of N separate
 * routes; tabs render as pills when there's more than one.
 */
const FinancePage = ({ label, phase, tabs = [] }) => {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);
  const active = tabs.find(t => t.key === activeKey) || tabs[0];

  return (
    <div className="list add flex-col">
      <div className="admin-list-container">
        <div className="admin-header-split">
          <div>
            <h1>{label}</h1>
            <p className="admin-subtitle">
              {tabs.length > 1 ? 'Select a tab below.' : "This section isn't built yet — it's on the roadmap."}
            </p>
          </div>
          {phase && <div className="admin-count-badge">{phase} — coming soon</div>}
        </div>

        {tabs.length > 1 && (
          <div className="admin-category-scroll">
            {tabs.map(t => (
              <button
                key={t.key}
                className={`admin-cat-pill${activeKey === t.key ? ' active' : ''}`}
                onClick={() => setActiveKey(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="admin-empty-state">
          <p>{active?.description || "This section isn't built yet — it's on the roadmap."}</p>
        </div>
      </div>
    </div>
  );
};

export default FinancePage;
