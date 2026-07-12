import {
  faGaugeHigh, faBuilding, faCirclePlus, faUsersGear, faClipboardList,
  faScaleBalanced, faFileInvoice, faCartShopping, faMoneyBillTransfer,
  faFileSignature, faChartPie, faFileExport, faListCheck,
} from '@fortawesome/free-solid-svg-icons';

/*
 * Single source of truth for the Finance workspace — sidebar, mobile nav,
 * and routes (App.jsx) all render off this list. Consolidated to the 13
 * top-level pages from the ERP roadmap's "UI Page Structure" table —
 * related screens live as in-page tabs (see `tabs` on each item, rendered
 * with the same category-pill pattern as the Designs list page) instead
 * of each becoming its own route.
 */
export const FINANCE_NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      {
        to: '/finance', icon: faGaugeHigh, label: 'Dashboard',
        tabs: [{ key: 'overview', label: 'Overview', description: 'Finance home — shortcuts into every section below.' }],
      },
    ],
  },
  {
    label: 'Projects',
    phase: 'Phase 0.5',
    items: [
      {
        to: '/finance/projects', icon: faBuilding, label: 'All Projects',
        tabs: [{ key: 'list', label: 'List', description: 'Project list with filters — links out to the New Project wizard or a project\'s detail page.' }],
      },
      {
        to: '/finance/projects/new', icon: faCirclePlus, label: 'New Project',
        tabs: [{ key: 'wizard', label: 'Wizard', description: 'Guided 6-step setup: basic info, contract type, conditional rate setup, team assignment, and — for Advance contracts — the upfront payment.' }],
      },
    ],
  },
  {
    label: 'Masters',
    phase: 'Phase 0',
    items: [
      {
        to: '/finance/masters', icon: faUsersGear, label: 'Master Data',
        tabs: [
          { key: 'clients',   label: 'Clients',         description: 'Client master — name, contact, billing details.' },
          { key: 'vendors',   label: 'Vendors',          description: 'Vendor master — material suppliers, labour contractors, referral partners.' },
          { key: 'employees', label: 'Employees',        description: 'Salaried staff master, separate from labour teams.' },
          { key: 'materials', label: 'Materials',        description: 'Material master with minimum stock levels.' },
          { key: 'teams',     label: 'Labour Teams',     description: 'Labour team master — the teams assigned to projects and rated per work type.' },
          { key: 'settings',  label: 'Settings & Lists', description: 'Work types, expense categories, payment modes, TDS sections, and other dropdown lists.' },
        ],
      },
    ],
  },
  {
    label: 'Daily Operations',
    phase: 'Phase 1',
    items: [
      {
        to: '/finance/daily-entry', icon: faClipboardList, label: 'Daily Site Entry',
        tabs: [
          { key: 'work-report',  label: 'Work Report',    description: 'Mobile-first site entry — date, project, team, work type, area covered.' },
          { key: 'material',     label: 'Material In/Out', description: 'Material received and issue logs, including margin % and issue type (used / wasted / damaged / lost).' },
          { key: 'advances',     label: 'Labour Advances', description: 'Advances paid to teams — routine weekly or one-time, company or site-owner paid.' },
          { key: 'expenses',     label: 'Expenses',        description: 'Site expenses tagged by category and who bore the cost — company, contractor, or client.' },
          { key: 'attendance',   label: 'Attendance',      description: 'Attendance for salaried employees.' },
        ],
      },
    ],
  },
  {
    label: 'Settlements',
    phase: 'Phase 2',
    items: [
      {
        to: '/finance/settlements', icon: faScaleBalanced, label: 'Month-End Settlements',
        tabs: [
          { key: 'labour',     label: 'Labour Settlement',    description: 'Monthly net payable per project + team, after advances and recoveries.' },
          { key: 'project',    label: 'Project Settlement',   description: 'Monthly project settlement — billing, cost, profit, and the advance drawdown for Advance contracts.' },
          { key: 'supervisor', label: 'Supervisor Incentive', description: 'Monthly incentive per supervisor, by approved area supervised.' },
        ],
      },
    ],
  },
  {
    label: 'Registers',
    phase: 'Phase 3',
    items: [
      {
        to: '/finance/sales-register', icon: faFileInvoice, label: 'Sales Register',
        tabs: [
          { key: 'invoices', label: 'Invoices',               description: 'Client invoices, linked to payments received.' },
          { key: 'schedule', label: 'Client Payment Schedule', description: 'Expected client payment milestones.' },
        ],
      },
      {
        to: '/finance/purchase-register', icon: faCartShopping, label: 'Purchase Register',
        tabs: [
          { key: 'orders',   label: 'Purchase Orders',        description: 'Material purchase orders.' },
          { key: 'schedule', label: 'Vendor Payment Schedule', description: 'Expected vendor payment milestones.' },
        ],
      },
      {
        to: '/finance/payments', icon: faMoneyBillTransfer, label: 'Payments',
        tabs: [{ key: 'tracker', label: 'Payment Tracker', description: 'All payments — client receipts and vendor/contractor payouts — with TDS section, rate, and amount, kept unified in one tracker.' }],
      },
      {
        to: '/finance/quotations', icon: faFileSignature, label: 'Quotations',
        tabs: [{ key: 'quotations', label: 'Quotations', description: 'Client quotations issued, pre-project — kept standalone since no Project ID exists yet.' }],
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        to: '/finance/dashboards', icon: faChartPie, label: 'Dashboards', phase: 'Phase 4',
        tabs: [
          { key: 'executive', label: 'Executive Summary', description: 'Active projects, pending settlements, cash position, receivables/payables.' },
          { key: 'trends',    label: 'Monthly Trends',     description: 'Revenue, labour, material, expenses, and profit over the last N months.' },
        ],
      },
      {
        to: '/finance/reports', icon: faFileExport, label: 'Reports & Exports', phase: 'Phase 5',
        tabs: [
          { key: 'ca-package',  label: 'CA Package',            description: 'One-click monthly PDF for your CA — GST summary, TDS summary, P&L, and appendices.' },
          { key: 'client-bill', label: 'Client Bill Statement', description: 'Client-facing PDF — day-by-day work log, subtotals, deductions, and net amount due for a project + date range.' },
        ],
      },
    ],
  },
  {
    label: 'Month-End',
    phase: 'Phase 6',
    items: [
      {
        to: '/finance/reconciliation', icon: faListCheck, label: 'Reconciliation',
        tabs: [
          { key: 'checklist', label: 'Month-End Checklist', description: 'Guided 10-step month-end workflow — approve entries, settle labour, verify stock, invoice, chase receivables, pay vendors, GST, TDS, bank reconciliation, review.' },
          { key: 'bank',      label: 'Bank Reconciliation', description: 'Bank statement import and match.' },
          { key: 'audits',    label: 'Audits',              description: 'Stock, settlement, billing, vendor, and salary-TDS mini-audits.' },
        ],
      },
    ],
  },
];

/* Flattened, for route generation in App.jsx and the FinanceHome shortcut cards.
   Items inherit their section's `phase` unless they set their own (Insights mixes phases). */
export const FINANCE_ROUTES = FINANCE_NAV_SECTIONS.flatMap(({ phase: sectionPhase, items }) =>
  items.map(({ to, icon, label, phase, tabs }) => ({ to, icon, label, phase: phase || sectionPhase, tabs }))
);
