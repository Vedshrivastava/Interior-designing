import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import '../../styles/dashboard.css';

// One consistent palette across every chart in every tier of the Finance
// Dashboard — Recharts is the only charting library in this codebase
// (added specifically for this build), so nothing here should ever mix
// with another library's color conventions.
export const CHART_COLORS = ['#2d4a35', '#c9a87c', '#c0392b', '#4a7a8c', '#8a6d3e', '#9a8e84', '#6b8f71', '#b08968'];

export const formatINR = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

// `icon` (optional): a @fortawesome/free-solid-svg-icons import, shown in a
// tone-tinted badge beside the label/value column (not stacked above it) —
// same icon set the sidebar already uses, so no new dependency. `hero`
// (optional): the two headline this-month figures get a solid-color
// treatment instead of blending into the same flat white grid as every
// count/alert card. `goldAccent` (optional): a warm gold-wash background,
// purely a color treatment — same card layout either way.
export const KpiCard = ({ label, value, sub, onClick, tone, icon, hero, goldAccent }) => (
    <div className={`dash-kpi-card${onClick ? ' clickable' : ''}${hero ? ' hero' : ''}${goldAccent ? ' gold-accent' : ''}${tone ? ` tone-${tone}` : ''}`} onClick={onClick}>
        <div className="dash-kpi-row">
            {icon && (
                <div className={`dash-kpi-icon${tone ? ` tone-${tone}` : ''}`}>
                    <FontAwesomeIcon icon={icon} />
                </div>
            )}
            <div className="dash-kpi-text">
                <p className="dash-kpi-label">{label}</p>
                <p className={`dash-kpi-value${tone ? ` tone-${tone}` : ''}`}>{value}</p>
            </div>
        </div>
        {sub && <p className="dash-kpi-sub">{sub}</p>}
    </div>
);

export const KpiGrid = ({ children, hero }) => <div className={`dash-kpi-grid${hero ? ' hero-row' : ''}`}>{children}</div>;

// Small uppercase divider above each grouped row of KPI cards, so the 13
// company-wide numbers read as a few related clusters instead of one flat
// wall of boxes.
export const KpiSectionLabel = ({ children }) => <p className="dash-kpi-section-label">{children}</p>;

export const ChartCard = ({ title, children }) => (
    <div className="dash-chart-card">
        <p className="dash-chart-title">{title}</p>
        {children}
    </div>
);

export const ChartGrid = ({ children }) => <div className="dash-chart-grid">{children}</div>;

export const EmptyChart = ({ text = 'Not enough data yet.' }) => <div className="dash-empty">{text}</div>;

// Recent Activity panel — its own component (not a reuse of the generic
// list-table CRUD styling) so its row layout and "view all" footer can be
// built to match this card's own padding, instead of a manually-placed
// link that doesn't line up with anything else in the card.
export const ActivityCard = ({ title, items, renderRow, onViewAll, viewAllLabel = 'View Full Timeline', emptyText = 'No activity recorded yet.' }) => (
    <div className="dash-chart-card dash-activity-card">
        <p className="dash-chart-title">{title}</p>
        {items?.length > 0 ? (
            <div className="dash-activity-list">
                {items.map(renderRow)}
            </div>
        ) : <EmptyChart text={emptyText} />}
        {onViewAll && (
            <button type="button" className="dash-activity-viewall" onClick={onViewAll}>
                {viewAllLabel}
                <FontAwesomeIcon icon={faArrowRight} />
            </button>
        )}
    </div>
);
