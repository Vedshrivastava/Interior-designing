import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight, faChevronRight, faXmark,
    faHardHat, faPersonDigging, faUsers, faHandHoldingDollar, faReceipt, faBoxOpen,
    faTriangleExclamation, faFileInvoiceDollar, faFileInvoice, faRulerCombined, faClipboardList,
    faBuilding, faBuildingColumns,
} from '@fortawesome/free-solid-svg-icons';
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

// Builds a KpiCard `sub` line out of a headline's own contributing terms
// (e.g. Contractor Payables = Earned − Advances − Deductions − Direct Pay −
// Paid) — a bare balance with no visible factors gives no sense of whether
// it's driven by fresh earnings or by payments simply not having caught up
// yet. Zero-value terms are dropped so a simple case ("Earned ₹X · Paid ₹Y")
// doesn't drag along a string of "· Advances ₹0 · Deductions ₹0". Each part
// is [label, amount, subtract?] — subtract:true prefixes a minus sign
// against the plain (always-positive) amount, so "Returned ₹240,000"
// becomes "− Returned ₹240,000" instead of formatINR's own negative-number
// rendering producing a confusing double-negative like "Returned -₹240,000".
export const buildBreakdownSub = (parts) => {
    const shown = parts.filter(([, v]) => v);
    return shown.length ? shown.map(([label, v, subtract]) => `${subtract ? '− ' : ''}${label} ${formatINR(Math.abs(v))}`).join('  ') : undefined;
};

// A contractor/labourer ledger's Balance Payable going negative ("Extra
// Paid") is a different question than the still-owed case — not "what
// factors add up to this," but "who actually overpaid, and from where."
// Splits the excess into money the company itself sent (advances +
// payments — both are real cash the company disbursed, just booked under
// different categories) versus money the client already covered directly
// (directPaymentTotal), against net earnings (deductions/material waste
// already netted out, clamped at 0 — a deduction pile exceeding raw
// earnings is a separate, rare edge case not worth a confusing negative
// third term here). These three always sum to exactly
// Math.abs(totals.balancePayable) whenever it's negative. Only meaningful
// in that overpaid case — callers should keep buildBreakdownSub's full
// earn-minus-every-cost formula for the still-owed case instead.
export const extraPaidSub = (totals) => {
    if (!totals || totals.balancePayable >= 0) return undefined;
    const paidByUs = (totals.advances || 0) + (totals.payments || 0);
    const paidByClient = totals.directPaymentTotal || 0;
    const netEarned = Math.max(0, (totals.earnings || 0) - (totals.deductions || 0) - (totals.materialWasteTotal || 0));
    // "Paid by Us" stays gross (TDS withheld still discharges what's owed —
    // it left the company and settled the debt, just via the tax department
    // instead of the contractor's hand) — but the label itself surfaces the
    // cash/TDS split so it doesn't read as if the full figure reached them
    // as cash. See financeContractorLedger.js's header comment.
    const tdsTotal = totals.tdsTotal || 0;
    const paidByUsLabel = tdsTotal > 0 ? `Paid by Us (${formatINR(paidByUs - tdsTotal)} cash + ${formatINR(tdsTotal)} TDS)` : 'Paid by Us';
    return buildBreakdownSub([
        [paidByUsLabel, paidByUs],
        ['Paid by Client', paidByClient],
        ['Earned', netEarned, true],
    ]);
};

// "Payment Left - Unapproved" (Dashboard and, per-project, Project Overview)
// used to only ever mention the client-side half of this (direct payments)
// — the company's own advances/payments against this same contractor/
// labourer relationship are equally un-netted from this figure
// (unapprovedContractorTotal/unapprovedContractorCost is a flat area × rate
// value, not a balance; nothing gets subtracted from it at all), so leaving
// those out told only half the "money that's already moved but isn't
// reflected here" story. Both paidByUs and paidByClient come from the exact
// same Payables breakdown the "Approved" Contractor/Labour Payables cards
// already surface, just re-read here instead of duplicated.
// tdsTotal (optional) splits paidByUs into what actually reached the
// contractor/labourer in cash vs what was withheld as TDS — paidByUs itself
// stays gross (matches balancePayable's own gross-based math, see
// financeContractorLedger.js's header comment), this just makes the "already
// moved" figure legible instead of reading as if the full amount left as cash.
export const unapprovedPaidNote = (paidByClient, paidByUs, whom, tdsTotal = 0) => {
    const parts = [];
    if (paidByClient > 0) parts.push(`${formatINR(paidByClient)} paid directly by client`);
    if (paidByUs > 0) {
        const tdsNote = tdsTotal > 0 ? ` — ${formatINR(paidByUs - tdsTotal)} cash + ${formatINR(tdsTotal)} TDS withheld` : '';
        parts.push(`${formatINR(paidByUs)} already paid by us (advances + payments)${tdsNote}`);
    }
    return parts.length ? `${parts.join(', ')} to ${whom} — neither netted against this` : undefined;
};

// Shared by every "profit per project" bar chart (Dashboard, All Projects) —
// project names run long ("Malhotra Enterprises — HQ Advance Contract") and
// the chart's y-axis has nowhere near that much room. Recharts renders axis
// ticks as raw SVG text, so CSS text-overflow can't help; truncate the tick
// label itself instead (the tooltip still shows the full name via the data
// object, untouched).
export const truncateLabel = (name, max = 15) => (name.length > max ? `${name.slice(0, max - 1)}…` : name);

// Recharts' own Y-axis tick <Text> component applies its own word-wrapping
// against the axis `width`, which mangles long category labels in ways a
// tickFormatter alone can't prevent (different names truncate to wildly
// different, sometimes single-letter, lengths). A custom tick renders
// exactly the string we hand it — no further "helpful" wrapping.
export const ProjectNameTick = ({ x, y, payload }) => (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="#5a5248">
        {truncateLabel(payload.value)}
    </text>
);

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
                {/* Truncated to one line with a trailing "…" via pure CSS
                    (text-overflow: ellipsis) — same idea as the frontend
                    home page's card text (line-clamp there, single-line
                    ellipsis here since this is meant to stay one line),
                    at whatever width the card actually has, mobile or
                    desktop. The chevron below always opens the full,
                    untruncated text — this line is only a preview. */}
                {!loading && sub && <p className="dash-kpi-sub">{sub}</p>}
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
                        {/* Full, untruncated text — this is the box's own
                            complete explanation, never clipped regardless
                            of how the inline preview above had to shrink it. */}
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

// One entry per FinanceActivityLog eventType (see Backend/utils/
// financeActivityLog.js and every controller's logActivity() call) —
// `tone` is about which way money actually moved for the COMPANY's own
// accounts, not just "does this row have an amount": a deduction or a bill
// being generated carries a ₹ figure but isn't itself cash moving, so it
// stays neutral; an internal bank_transfer nets to zero for the company
// as a whole, also neutral. Only genuine inflows (client payments, vendor
// refunds) and outflows (every payment/advance/purchase/deposit) get a
// directional tint. Icon is per broad category, not per exact eventType —
// 40+ distinct icons would be its own kind of clutter. Picked to stay
// visually consistent as a set: faCartShopping (wheels, basket weave) reads
// noticeably bolder/busier than the plain line-style document/ruler icons
// at the small size this list renders at, so material/vendor rows use
// faBoxOpen (a plainer silhouette) instead — .dash-activity-icon's own
// opacity also takes the remaining edge off the inherently chunkier
// pictorial icons (faHardHat, faPersonDigging) FA's free set has no
// thinner equivalent for.
export const ACTIVITY_META = {
    contractor_paid: { tone: 'out', icon: faHardHat },
    contractor_advance_given: { tone: 'out', icon: faHardHat },
    contractor_deduction_applied: { tone: 'neutral', icon: faHardHat },
    labour_paid: { tone: 'out', icon: faPersonDigging },
    labour_advance_given: { tone: 'out', icon: faPersonDigging },
    labour_deduction_applied: { tone: 'neutral', icon: faPersonDigging },
    labour_provider_paid: { tone: 'out', icon: faPersonDigging },
    salary_paid: { tone: 'out', icon: faUsers },
    supervisor_incentive_given: { tone: 'out', icon: faUsers },
    supervisor_deduction_applied: { tone: 'neutral', icon: faUsers },
    commission_paid: { tone: 'out', icon: faHandHoldingDollar },
    expense_paid: { tone: 'out', icon: faReceipt },
    expense_recorded: { tone: 'neutral', icon: faReceipt },
    material_purchased: { tone: 'out', icon: faBoxOpen },
    stock_returned: { tone: 'neutral', icon: faBoxOpen },
    stock_dumped: { tone: 'neutral', icon: faBoxOpen },
    stock_wasted: { tone: 'neutral', icon: faTriangleExclamation },
    vendor_paid: { tone: 'out', icon: faBoxOpen },
    vendor_refund_received: { tone: 'in', icon: faBoxOpen },
    receipt_received: { tone: 'in', icon: faFileInvoiceDollar },
    running_bill_generated: { tone: 'neutral', icon: faFileInvoiceDollar },
    tds_deposited: { tone: 'out', icon: faFileInvoiceDollar },
    measurement_logged: { tone: 'neutral', icon: faRulerCombined },
    labour_measurement_logged: { tone: 'neutral', icon: faRulerCombined },
    measurement_deleted: { tone: 'neutral', icon: faRulerCombined },
    labour_measurement_deleted: { tone: 'neutral', icon: faRulerCombined },
    work_created: { tone: 'neutral', icon: faClipboardList },
    work_completed: { tone: 'neutral', icon: faClipboardList },
    work_reviewed: { tone: 'neutral', icon: faClipboardList },
    work_contractor_assignment_added: { tone: 'neutral', icon: faClipboardList },
    work_contractor_assignment_removed: { tone: 'neutral', icon: faClipboardList },
    work_labour_team_added: { tone: 'neutral', icon: faClipboardList },
    work_labour_assignment_removed: { tone: 'neutral', icon: faClipboardList },
    project_created: { tone: 'neutral', icon: faBuilding },
    project_activated: { tone: 'neutral', icon: faBuilding },
    project_completed: { tone: 'neutral', icon: faBuilding },
    client_quotation_issued: { tone: 'neutral', icon: faFileInvoice },
    client_quotation_status_changed: { tone: 'neutral', icon: faFileInvoice },
    client_direct_payment_recorded: { tone: 'neutral', icon: faHandHoldingDollar },
    site_diary_entry: { tone: 'neutral', icon: faClipboardList },
    site_diary_issue_resolved: { tone: 'neutral', icon: faClipboardList },
    bank_transfer: { tone: 'neutral', icon: faBuildingColumns },
};
export const DEFAULT_ACTIVITY_META = { tone: 'neutral', icon: faClipboardList };

// Wraps each name in `entityNames` (the contractor/labourer/vendor/etc.
// party already interpolated server-side into `summary` — see
// FinanceActivityLog's own comment) in a styled span, so "Contractor
// test_1 paid" reads with test_1 visually distinct from the surrounding
// sentence. Styling only for now, not an actual link — see the entity's
// own real page/route isn't resolvable from the activity log's current
// data for most event types without a larger backend change.
export const highlightEntities = (summary, entityNames) => {
    const names = (entityNames || []).filter(Boolean);
    if (!names.length) return summary;
    const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(${escaped.join('|')})`, 'g');
    return summary.split(re).map((part, i) => (names.includes(part) ? <span key={i} className="dash-activity-entity">{part}</span> : part));
};

// Recent Activity panel — its own component (not a reuse of the generic
// list-table CRUD styling) so its row layout and "view all" footer can be
// built to match this card's own padding, instead of a manually-placed
// link that doesn't line up with anything else in the card. Rows group
// under a single date heading instead of repeating the date per row (see
// ActivityTimelinePage.jsx's identical grouping for the full-page version
// of this feed). `loading` (optional): shows ChartSkeleton in place of the
// list/empty-state, same reasoning as everywhere else it's used — "no
// activity yet" must never be what a still-in-flight fetch looks like.
export const ActivityCard = ({ title, items, onViewAll, viewAllLabel = 'View Full Timeline', emptyText = 'No activity recorded yet.', loading }) => {
    const dayKeys = [];
    const byDay = new Map();
    for (const a of items || []) {
        const key = new Date(a.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        if (!byDay.has(key)) { byDay.set(key, []); dayKeys.push(key); }
        byDay.get(key).push(a);
    }

    return (
        <div className="dash-chart-card dash-activity-card">
            <p className="dash-chart-title">{title}</p>
            {loading ? <ChartSkeleton /> : items?.length > 0 ? (
                <div className="dash-activity-list">
                    {dayKeys.map(day => (
                        <div key={day} className="dash-activity-group">
                            <p className="dash-activity-date-heading">{day}</p>
                            {byDay.get(day).map(a => {
                                const meta = ACTIVITY_META[a.eventType] || DEFAULT_ACTIVITY_META;
                                return (
                                    <div key={a._id} className="dash-activity-row">
                                        <span className={`dash-activity-icon tone-${meta.tone}`}>
                                            <FontAwesomeIcon icon={meta.icon} />
                                        </span>
                                        <span className="dash-activity-summary">{highlightEntities(a.summary, a.entityNames)}</span>
                                        {a.amount != null && <span className="dash-activity-amount">{formatINR(a.amount)}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
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
};
