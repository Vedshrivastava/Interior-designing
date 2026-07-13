import React from 'react';
import '../../styles/dashboard.css';

// One consistent palette across every chart in every tier of the Finance
// Dashboard — Recharts is the only charting library in this codebase
// (added specifically for this build), so nothing here should ever mix
// with another library's color conventions.
export const CHART_COLORS = ['#2d4a35', '#c9a87c', '#c0392b', '#4a7a8c', '#8a6d3e', '#9a8e84', '#6b8f71', '#b08968'];

export const formatINR = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export const KpiCard = ({ label, value, sub, onClick, tone }) => (
    <div className={`dash-kpi-card${onClick ? ' clickable' : ''}`} onClick={onClick}>
        <p className="dash-kpi-label">{label}</p>
        <p className={`dash-kpi-value${tone ? ` tone-${tone}` : ''}`}>{value}</p>
        {sub && <p className="dash-kpi-sub">{sub}</p>}
    </div>
);

export const KpiGrid = ({ children }) => <div className="dash-kpi-grid">{children}</div>;

export const ChartCard = ({ title, children }) => (
    <div className="dash-chart-card">
        <p className="dash-chart-title">{title}</p>
        {children}
    </div>
);

export const ChartGrid = ({ children }) => <div className="dash-chart-grid">{children}</div>;

export const EmptyChart = ({ text = 'Not enough data yet.' }) => <div className="dash-empty">{text}</div>;
