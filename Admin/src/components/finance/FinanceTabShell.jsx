import React from 'react';
import '../../styles/list.css';

/*
 * Shared header + category-pill shell for every Finance page — same pattern
 * as ListDesigns ('.admin-category-scroll' / '.admin-cat-pill'). Extracted
 * from the original FinancePage so bespoke pages that mix real content with
 * placeholder tabs (Clients detail, Procurement, Contractors) can reuse the
 * exact same look without duplicating the markup.
 */
const FinanceTabShell = ({ label, subtitle, badge, headerAction, tabs = [], activeKey, onTabChange, backLink, children }) => (
  <div className="list add flex-col">
    <div className="admin-list-container">
      <div className="admin-header-split">
        <div>
          {backLink}
          <h1>{label}</h1>
          {subtitle && <p className="admin-subtitle">{subtitle}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {badge && <div className="admin-count-badge">{badge}</div>}
          {headerAction}
        </div>
      </div>

      {tabs.length > 1 && (
        <div className="admin-category-scroll">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`admin-cat-pill${activeKey === t.key ? ' active' : ''}`}
              onClick={() => onTabChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {children}
    </div>
  </div>
);

export default FinanceTabShell;
