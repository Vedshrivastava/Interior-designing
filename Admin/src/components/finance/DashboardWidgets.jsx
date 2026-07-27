import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faChevronRight, faXmark } from '@fortawesome/free-solid-svg-icons';
import '../../styles/dashboard.css';

// "Total Expense - Ongoing Projects" → title "Total Expense", qualifier
// "Ongoing Projects" shown as its own small pill instead of forcing the
// heading to wrap across 2-3 lines. Every current call site's label either
// has no " - " at all (title stays as-is, no pill) or uses it exactly as
// this qualifier suffix (verified against every KpiCard usage in the app —
// none use " - " as part of a single indivisible phrase), so this is safe
// to apply unconditionally rather than needing an explicit extra prop.
const splitLabel = (label) => {
    const idx = label.indexOf(' - ');
    return idx === -1 ? { title: label, qualifier: null } : { title: label.slice(0, idx), qualifier: label.slice(idx + 3) };
};

// One consistent palette across every chart in every tier of the Finance
// Dashboard — Recharts is the only charting library in this codebase
// (added specifically for this build), so nothing here should ever mix
// with another library's color conventions.
export const CHART_COLORS = ['#2d4a35', '#c9a87c', '#c0392b', '#4a7a8c', '#8a6d3e', '#9a8e84', '#6b8f71', '#b08968'];

// Sign goes before the ₹ symbol, not after — `${Math.round(n)}`.toLocaleString()
// on a negative number already carries its own "-", so naively prefixing
// "₹" produced "₹-3,00,000" instead of the conventional "-₹3,00,000".
export const formatINR = (n) => {
    const rounded = Math.round(n || 0);
    return `${rounded < 0 ? '-' : ''}₹${Math.abs(rounded).toLocaleString('en-IN')}`;
};

// `icon` (optional): a @fortawesome/free-solid-svg-icons import, shown bare
// (no background badge) above the title, tinted by `tone` — moss green for
// `good`, a muted brick-red for `danger`, brand gold for the untoned/
// informational default. `hero` (optional): the two headline this-month
// figures stay physically bigger than every count/alert card below, but use
// the exact same white-card look — no separate color treatment. `loading`
// (optional): the card, icon, and title render immediately (the grid's
// shape never jumps around as data arrives) with a shimmer bar standing in
// for the value — same "this piece specifically is still loading" idea as
// ChartSkeleton, at KPI-card scale. Not clickable while loading (there's
// nothing to show yet).
export const KpiCard = ({ label, value, sub, onClick, tone, icon, hero, loading }) => {
    const [detailOpen, setDetailOpen] = useState(false);
    const { title, qualifier } = splitLabel(label);

    // Never truncated with "…" — rather than guess a character budget (which
    // would need a different number for every grid this shared card ends up
    // in, from a 2-up mobile tile to a 6-up desktop row), actually measure
    // whether the rendered line overflows its own box and drop it entirely
    // if so; the chevron's sheet always has the full, untruncated text
    // regardless. useLayoutEffect runs before paint, so a line that doesn't
    // fit is hidden before the browser ever shows it mid-clip.
    const subRef = useRef(null);
    const [subFits, setSubFits] = useState(true);
    useLayoutEffect(() => {
        const measure = () => {
            const el = subRef.current;
            if (el) setSubFits(el.scrollWidth <= el.clientWidth + 1);
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [sub, value, qualifier, title]);

    return (
        <>
            <div
                className={`dash-kpi-card${onClick && !loading ? ' clickable' : ''}${hero ? ' hero' : ''}${tone ? ` tone-${tone}` : ''}`}
                onClick={loading ? undefined : onClick}
            >
                {!loading && sub && (
                    <button
                        type="button"
                        className="dash-kpi-chevron"
                        aria-label="See details"
                        onClick={(e) => { e.stopPropagation(); setDetailOpen(true); }}
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                )}
                {icon && (
                    <div className={`dash-kpi-icon${tone ? ` tone-${tone}` : ''}`}>
                        <FontAwesomeIcon icon={icon} />
                    </div>
                )}
                <p className="dash-kpi-label">{title}</p>
                {loading ? <div className="kpi-skeleton-bar" /> : <p className={`dash-kpi-value${tone ? ` tone-${tone}` : ''}`}>{value}</p>}
                {!loading && qualifier && <span className="dash-kpi-qualifier">{qualifier}</span>}
                {!loading && sub && (
                    <p ref={subRef} className="dash-kpi-sub" style={subFits ? undefined : { display: 'none' }}>{sub}</p>
                )}
            </div>

            {detailOpen && createPortal(
                // Rendered into document.body, not in place — .admin-list-container's
                // entrance animation uses animation-fill-mode: both, which leaves a
                // permanent (no-op) `transform: translateY(0)` on it even once the
                // animation finishes. Per the CSS spec, any non-none transform on an
                // ancestor creates a new containing block for fixed-position
                // descendants, so this sheet would otherwise anchor to that
                // container's box instead of the real viewport. A portal sidesteps
                // the ancestor chain entirely.
                <div className="dash-kpi-sheet-backdrop" onClick={() => setDetailOpen(false)}>
                    <div className="dash-kpi-sheet" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="dash-kpi-sheet-close" onClick={() => setDetailOpen(false)} aria-label="Close">
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                        <div className="dash-kpi-sheet-head">
                            {icon && (
                                <div className={`dash-kpi-icon${tone ? ` tone-${tone}` : ''}`}>
                                    <FontAwesomeIcon icon={icon} />
                                </div>
                            )}
                            <p className="dash-kpi-sheet-label">{label}</p>
                        </div>
                        <p className={`dash-kpi-sheet-value${tone ? ` tone-${tone}` : ''}`}>{value}</p>
                        {sub && <p className="dash-kpi-sheet-sub">{sub}</p>}
                        {onClick && (
                            <button
                                type="button"
                                className="dash-kpi-sheet-cta"
                                onClick={() => { setDetailOpen(false); onClick(); }}
                            >
                                View details
                                <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

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

// Shown in place of a chart while its data is still in flight — distinct
// from EmptyChart on purpose, so "still loading" never reads as "confirmed
// zero/none" (a real bug this fixed: a chart briefly showing "No active
// bills" before its fetch had even returned). A few shimmering bars in
// roughly the shape of the bar charts this dashboard actually uses, not a
// generic spinner, so it reads as "this chart specifically" loading.
export const ChartSkeleton = () => (
    <div className="chart-skeleton" aria-busy="true" aria-label="Loading chart">
        {[92, 68, 84, 55, 74].map((w, i) => (
            <div key={i} className="chart-skeleton-bar" style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }} />
        ))}
    </div>
);

// Custom Recharts tooltip content — replaces the library's unstyled default
// box (plain white, system border) with something matching the rest of
// this dashboard. Pass as `<Tooltip content={<ChartTooltip />} />`; Recharts
// injects `active`/`payload`/`label` itself.
export const ChartTooltip = ({ active, payload, label, valueFormatter = formatINR }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="dash-tooltip">
            {label != null && label !== '' && <p className="dash-tooltip-label">{label}</p>}
            {payload.map((p, i) => (
                <div key={i} className="dash-tooltip-row">
                    <span className="dash-tooltip-swatch" style={{ background: p.color || p.fill || p.payload?.fill }} />
                    <span className="dash-tooltip-name">{p.name}</span>
                    <span className="dash-tooltip-value">{valueFormatter(p.value)}</span>
                </div>
            ))}
        </div>
    );
};

// Recent Activity panel — its own component (not a reuse of the generic
// list-table CRUD styling) so its row layout and "view all" footer can be
// built to match this card's own padding, instead of a manually-placed
// link that doesn't line up with anything else in the card. `loading`
// (optional): shows ChartSkeleton in place of the list/empty-state, same
// reasoning as everywhere else it's used — "no activity yet" must never
// be what a still-in-flight fetch looks like.
export const ActivityCard = ({ title, items, renderRow, onViewAll, viewAllLabel = 'View Full Timeline', emptyText = 'No activity recorded yet.', loading }) => (
    <div className="dash-chart-card dash-activity-card">
        <p className="dash-chart-title">{title}</p>
        {loading ? <ChartSkeleton /> : items?.length > 0 ? (
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
