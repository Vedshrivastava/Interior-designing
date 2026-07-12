import {
  faGaugeHigh, faUserTie, faHandshake, faUserGroup, faBoxesStacked,
  faBuilding, faCirclePlus, faClipboardList, faTruckRampBox, faDolly,
  faHandHoldingDollar, faReceipt, faCalendarCheck, faScaleBalanced,
  faFileInvoiceDollar, faAward, faWarehouse, faFileInvoice,
  faMoneyBillTransfer, faCartShopping, faFileSignature, faCalculator,
  faFileExport, faFileCircleCheck, faChartPie, faChartLine, faListCheck,
  faSliders,
} from '@fortawesome/free-solid-svg-icons';

/*
 * Single source of truth for the Finance workspace navigation — sidebar,
 * mobile nav, and routes (App.jsx) all render off this list. Mirrors the
 * ERP roadmap phases; most routes render a ComingSoon placeholder until
 * that phase is actually built.
 */
export const FINANCE_NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/finance', icon: faGaugeHigh, label: 'Dashboard' },
    ],
  },
  {
    label: 'Masters',
    phase: 'Phase 0',
    items: [
      { to: '/finance/clients',   icon: faUserTie,      label: 'Clients',   description: 'Client master — name, contact, billing details.' },
      { to: '/finance/vendors',   icon: faHandshake,    label: 'Vendors',   description: 'Vendor master — material suppliers, labour contractors, referral partners.' },
      { to: '/finance/employees', icon: faUserGroup,    label: 'Employees', description: 'Salaried staff master, separate from labour teams.' },
      { to: '/finance/materials', icon: faBoxesStacked, label: 'Materials', description: 'Material master with minimum stock levels.' },
    ],
  },
  {
    label: 'Contracts',
    phase: 'Phase 0.5',
    items: [
      { to: '/finance/projects',     icon: faBuilding,    label: 'All Projects', description: 'Finance-tracked projects — contract type, rates, status.' },
      { to: '/finance/projects/new', icon: faCirclePlus,  label: 'New Project',  description: 'Guided setup wizard: contract type, work-type rates, team rates, and — for Advance contracts — the upfront payment.' },
    ],
  },
  {
    label: 'Daily Operations',
    phase: 'Phase 1',
    items: [
      { to: '/finance/daily-reports',      icon: faClipboardList,      label: 'Daily Work Reports', description: 'Mobile-first site entry — date, project, team, work type, area covered.' },
      { to: '/finance/material-received',  icon: faTruckRampBox,       label: 'Material Received',  description: 'Material received logs, with margin % on each entry.' },
      { to: '/finance/material-issued',    icon: faDolly,               label: 'Material Issued',    description: 'Material issue logs — used for work, wasted, damaged, or lost.' },
      { to: '/finance/labour-advances',    icon: faHandHoldingDollar,  label: 'Labour Advances',    description: 'Advances paid to teams — routine weekly or one-time, company or site-owner paid.' },
      { to: '/finance/expenses',           icon: faReceipt,             label: 'Expenses',           description: 'Site expenses tagged by category and who bore the cost — company, contractor, or client.' },
      { to: '/finance/attendance',         icon: faCalendarCheck,      label: 'Attendance',         description: 'Attendance for salaried employees.' },
    ],
  },
  {
    label: 'Settlements',
    phase: 'Phase 2',
    items: [
      { to: '/finance/labour-settlement',     icon: faScaleBalanced,     label: 'Labour Settlement',     description: 'Monthly net payable per project + team, after advances and recoveries.' },
      { to: '/finance/site-settlement',       icon: faFileInvoiceDollar, label: 'Site Settlement',       description: 'Monthly project settlement — billing, cost, profit, and the advance drawdown for Advance contracts.' },
      { to: '/finance/supervisor-incentive',  icon: faAward,             label: 'Supervisor Incentive',  description: 'Monthly incentive per supervisor, by approved area supervised.' },
      { to: '/finance/material-stock',        icon: faWarehouse,         label: 'Material Stock',        description: 'Current stock per project + material, with low-stock flags.' },
    ],
  },
  {
    label: 'Registers',
    phase: 'Phase 3',
    items: [
      { to: '/finance/invoices',        icon: faFileInvoice,       label: 'Invoices',        description: 'Client invoices, linked to payments received.' },
      { to: '/finance/payments',        icon: faMoneyBillTransfer, label: 'Payments',        description: 'All payments — client receipts and vendor/contractor payouts — with TDS section, rate, and amount.' },
      { to: '/finance/purchase-orders', icon: faCartShopping,      label: 'Purchase Orders', description: 'Material purchase orders.' },
      { to: '/finance/quotations',      icon: faFileSignature,     label: 'Quotations',      description: 'Client quotations issued.' },
      { to: '/finance/boq-estimates',   icon: faCalculator,        label: 'BOQ Estimates',   description: 'Bill-of-quantities estimates.' },
    ],
  },
  {
    label: 'Reports',
    phase: 'Phase 5',
    items: [
      { to: '/finance/reports/ca-package',  icon: faFileExport,      label: 'CA Package',            description: 'One-click monthly PDF for your CA — GST summary, TDS summary, P&L, and appendices.' },
      { to: '/finance/reports/client-bill', icon: faFileCircleCheck, label: 'Client Bill Statement', description: 'Client-facing PDF — day-by-day work log, subtotals, deductions, and net amount due for a project + date range.' },
    ],
  },
  {
    label: 'Dashboards',
    phase: 'Phase 4',
    items: [
      { to: '/finance/dashboard/executive', icon: faChartPie,  label: 'Executive Summary', description: 'Active projects, pending settlements, cash position, receivables/payables.' },
      { to: '/finance/dashboard/trends',    icon: faChartLine, label: 'Monthly Trends',    description: 'Revenue, labour, material, expenses, and profit over the last N months.' },
    ],
  },
  {
    label: 'Month-End',
    phase: 'Phase 6',
    items: [
      { to: '/finance/reconciliation', icon: faListCheck, label: 'Reconciliation', description: 'Guided month-end checklist and bank statement reconciliation.' },
    ],
  },
  {
    label: 'Settings',
    phase: 'Phase 0',
    items: [
      { to: '/finance/settings', icon: faSliders, label: 'Finance Settings', description: 'Work types, expense categories, payment modes, TDS sections.' },
    ],
  },
];

/* Flattened, for route generation in App.jsx */
export const FINANCE_ROUTES = FINANCE_NAV_SECTIONS.flatMap(({ items }) => items);
