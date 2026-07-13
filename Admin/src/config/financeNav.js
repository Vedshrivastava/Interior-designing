import {
  faGaugeHigh, faClockRotateLeft, faUserTie, faBuilding, faCirclePlus,
  faClipboardList, faCartShopping, faWarehouse, faHardHat, faUserShield,
  faPersonDigging, faFileInvoiceDollar, faReceipt, faMoneyBillWave,
  faMoneyBillTransfer, faBuildingColumns, faBook, faFileExport, faUsersGear,
  faGear,
} from '@fortawesome/free-solid-svg-icons';

/*
 * Single source of truth for the Finance workspace — sidebar, mobile nav,
 * and routes (App.jsx) all render off this list.
 *
 * Restructured from the original 13-page layout into the 19-page target
 * structure below. Pages marked with a bespoke component in the "Old → new
 * mapping" comment at the bottom render their own React component (see
 * App.jsx's exclusion list); everything else renders through the generic
 * `FinancePage` shell off this file's `tabs` metadata.
 */
export const FINANCE_NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      {
        to: '/finance', icon: faGaugeHigh, label: 'Dashboard',
        // Absorbs the old standalone "Dashboards" (Phase 4) nav entry — same
        // destination, not a separate page. The real KPI dashboard (cash in
        // bank, receivables, today's profit, etc.) is still unbuilt future
        // work; this route stays the shortcut hub it already was.
        tabs: [{ key: 'overview', label: 'Overview', description: 'Finance home — shortcuts into every section below.' }],
      },
      {
        to: '/finance/activity', icon: faClockRotateLeft, label: 'Activity Timeline',
        tabs: [{ key: 'timeline', label: 'Timeline', description: 'Chronological log of every create/update/delete across the finance workspace — who did what, when. No audit-trail mechanism exists in the backend yet.' }],
      },
    ],
  },
  {
    label: 'Clients',
    items: [
      {
        to: '/finance/clients', icon: faUserTie, label: 'Clients',
        // Relocated out of Master Data — was the "Clients" tab there.
        tabs: [{ key: 'list', label: 'List', description: "Client master — name, contact, billing details. Each client opens into its own detail view." }],
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
    label: 'Operations',
    items: [
      {
        to: '/finance/site-operations', icon: faClipboardList, label: 'Site Operations',
        // Renamed/repositioned from "Daily Site Entry". Real as of the Works +
        // Measurements + Site Inventory build — Daily Measurements and
        // Material Consumption are both live; Site Diary stays a placeholder.
        tabs: [
          { key: 'measurements', label: 'Daily Measurements',   description: 'Mobile-first site entry — project, work, supervisor, area covered, materials used, photos. Saving updates the work\'s completed area and (if material tracking is on) logs stock consumption automatically.' },
          { key: 'consumption',  label: 'Material Consumption', description: 'Read-only log of material consumed, generated only by measurement saves.' },
          { key: 'diary',        label: 'Site Diary',           description: 'Daily site notes and issues log.' },
        ],
      },
      {
        to: '/finance/procurement', icon: faCartShopping, label: 'Procurement',
        // Bespoke component — Vendors tab is real (relocated Master Data →
        // Vendors, filtered to exclude labour_contractor; those live under
        // Contractors instead). Purchases/Material Dump/Returns/Ledger are
        // real as of the Procurement build: a purchase auto-creates a
        // `dump` financeStockMovement, a return auto-creates a `return`
        // one (both carry relatedPurchaseId) — Material Dump here is the
        // inventory-side read of exactly those. Ledger = purchases −
        // returns − payments, same computed shape as the Contractor Ledger.
        // Commission Ledger tab added in the Salary + Commission + Other
        // Expenses build — a picker on this same page (filtered to
        // vendorType 'referral' only, same pattern as Ledger's own picker)
        // feeds GET /api/finance/vendors/:vendorId/commission-ledger,
        // computed from financeWork completedAreaSqft ×
        // financeWorkTypeRate.referralRatePerSqft across the projects this
        // vendor referred, minus financeCommissionPayment payments.
        tabs: [{ key: 'vendors', label: 'Vendors', description: 'Material suppliers and other non-contractor vendors — labour contractors live under Contractors instead.' }],
      },
      {
        to: '/finance/site-inventory', icon: faWarehouse, label: 'Site Inventory',
        // Real as of the Works + Measurements + Site Inventory build — current
        // stock is computed on the fly (never stored), with a manual
        // dump/return/waste entry form and full movement history per project.
        // The material catalog itself (name, unit, minimum stock) stays under
        // Masters → Material Master. As of the Procurement build, `dump` and
        // `return` movements can ALSO be created automatically by a
        // Procurement purchase/return — manual entry here still works
        // independently for anything not tied to a formal purchase (opening
        // stock, ad-hoc site returns). `waste` stays manual-only either way.
        tabs: [{ key: 'ledger', label: 'Stock Ledger', description: 'Current stock, manual Dump/Return/Waste entry, and movement history per project + material.' }],
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        to: '/finance/contractors', icon: faHardHat, label: 'Contractors',
        // Bespoke component, built on the same vendor data as Procurement,
        // filtered to vendorType 'labour_contractor'. Settlements absorbs the
        // old standalone "Month-End Settlements" (Phase 2) nav item — as of
        // the Contractor Ledger build, Ledger and Settlements both render
        // the same computed earnings/advances/deductions/payments/balance
        // view (GET /api/finance/contractors/:vendorId/ledger); Works and
        // Measurements are real too, resolved via this contractor's teams.
        tabs: [{ key: 'overview', label: 'Overview', description: 'Vendors with type Labour Contractor.' }],
      },
      {
        to: '/finance/supervisors', icon: faUserShield, label: 'Supervisors',
        // New top-level section. No Supervisor master model exists —
        // `assignedSupervisor` on financeProject is still a plain string.
        // Employees stays under Masters; no real link between the two yet.
        tabs: [
          { key: 'projects',    label: 'Assigned Projects', description: "Projects grouped by each project's assignedSupervisor text field." },
          { key: 'labour',      label: 'Daily Labour',       description: 'Daily labour logged under each supervisor.' },
          { key: 'attendance',  label: 'Attendance',         description: 'Supervisor attendance.' },
          { key: 'performance', label: 'Performance',        description: 'Supervisor performance metrics.' },
          { key: 'salary',      label: 'Salary',             description: 'Supervisor salary.' },
          { key: 'incentives',  label: 'Incentives',         phase: 'Phase 2', description: 'Monthly incentive per supervisor, by approved area supervised.' },
        ],
      },
      {
        to: '/finance/daily-labour', icon: faPersonDigging, label: 'Daily Labour', phase: 'Phase 1',
        tabs: [
          { key: 'half-day',  label: 'Half Day',  description: 'Half-day labour entries.' },
          { key: 'full-day',  label: 'Full Day',  description: 'Full-day labour entries.' },
          { key: 'extra-day', label: 'Extra Day', description: 'Extra/overtime day labour entries.' },
          { key: 'rate',      label: 'Rate',      description: 'Applicable labour rate per entry.' },
          { key: 'amount',    label: 'Amount',    description: 'Computed payable amount per entry.' },
        ],
      },
    ],
  },
  {
    label: 'Money',
    items: [
      {
        to: '/finance/receivables', icon: faFileInvoiceDollar, label: 'Receivables',
        // Absorbs the old "Sales Register" nav item. Bespoke component as of
        // the Running Bills build — bill status (draft/issued) is real;
        // there's no due-date field anywhere to base a true "overdue" flag
        // on, so Pending Receipts (oldest issued bill first) is the honest
        // proxy instead of a guessed-at Overdue tab.
        tabs: [
          { key: 'running-bills',    label: 'Running Bills',     description: "Every bill for a project — draft and issued — with a Generate Bill flow that previews line items before confirming." },
          { key: 'pending-bills',    label: 'Pending Bills',     description: 'Bills generated but not yet issued (draft status).' },
          { key: 'approved-bills',   label: 'Approved Bills',    description: 'Bills issued to the client.' },
          { key: 'pending-receipts', label: 'Pending Receipts',  description: 'Every project with an issued bill and a positive outstanding balance, oldest bill first.' },
        ],
      },
      {
        to: '/finance/receipts', icon: faReceipt, label: 'Receipts',
        tabs: [{ key: 'received', label: 'Money Received', description: 'Client payments received — entry form and history, filterable by project.' }],
      },
      {
        to: '/finance/payables', icon: faMoneyBillWave, label: 'Payables',
        // Bespoke component — all five tabs real as of the Salary +
        // Commission + Other Expenses build. Contractor tab pulls
        // balancePayable from GET /api/finance/contractors/:vendorId/ledger
        // (Contractor Ledger build); Vendor tab pulls amountOwed from
        // GET /api/finance/vendors/:vendorId/ledger (Procurement build);
        // Salary tab pulls balanceDue per employee for the current month
        // from GET /api/finance/employees/:employeeId/salary-ledger;
        // Commission tab pulls commissionPayable per referral vendor from
        // GET /api/finance/vendors/:vendorId/commission-ledger; Other
        // Expenses renders the raw financeExpense log directly (no balance
        // to compute — it's paid when entered). Payables stays COMPUTED
        // throughout — no "financePayable" model exists anywhere; every
        // tab is a read of another collection's ledger/log.
        tabs: [
          { key: 'vendor',     label: 'Vendor',          description: 'Amount owed per vendor — purchases minus returns and payments already made.' },
          { key: 'contractor', label: 'Contractor',      description: 'Balance payable per contractor — earnings minus advances, deductions, and payments already made.' },
          { key: 'salary',     label: 'Salary',          description: 'Balance due per employee for the current month — expected salary minus salary payments made.' },
          { key: 'commission', label: 'Commission',      description: 'Commission payable per referral vendor — earned commission minus payments already made.' },
          { key: 'other',      label: 'Other Expenses',  description: 'Raw log of general company/site expenses — paid when entered, no balance to compute.' },
        ],
      },
      {
        to: '/finance/payments', icon: faMoneyBillTransfer, label: 'Payments',
        // Renamed/repositioned from "Payment Tracker". Bespoke component —
        // all five tabs real. Contractor Payment tab real since the
        // Contractor Ledger build, Vendor Payment tab real since the
        // Procurement build (both reuse the same financeContractorPayment/
        // financeVendorPayment data as their respective Ledger tabs,
        // reachable standalone from here too). Salary/Commission/Misc real
        // as of the Salary + Commission + Other Expenses build — Salary
        // posts to financeSalaryPayment (employee + month), Commission to
        // financeCommissionPayment (referral vendor only), Misc to
        // financeExpense (the same log ExpensesManager also renders under
        // Payables > Other Expenses). All three auto-create a
        // financeCashEntry when no bankAccountId is set, same bank/cash
        // automation as every other payment type.
        tabs: [
          { key: 'vendor',     label: 'Vendor Payment',     description: 'Payments made to material vendors — entry form and history.' },
          { key: 'contractor', label: 'Contractor Payment', description: 'Payments made to labour contractors — entry form and history.' },
          { key: 'salary',     label: 'Salary',             description: 'Salary payouts to employees, by month.' },
          { key: 'commission', label: 'Commission',         description: 'Referral commission payouts to referral-type vendors.' },
          { key: 'misc',       label: 'Miscellaneous',      description: 'Any other outgoing payment — general company/site expenses.' },
        ],
      },
      {
        to: '/finance/bank', icon: faBuildingColumns, label: 'Bank',
        // Promoted out of the old "Reconciliation" placeholder's Bank
        // Reconciliation tab into its own top-level section. Real as of
        // the Bank + Cash Book build — accounts, balance, and the computed
        // statement (opening + receipts/transfers-in − payments/transfers-
        // out, running balance) are all live. Receipts and Contractor/
        // Vendor Payments now carry an optional bankAccountId alongside
        // the older free-text bankOrCashLabel (kept for backward
        // compatibility) — set it and the statement here picks it up
        // directly. The old "Statements" tab's bank-statement-import/
        // reconciliation framing wasn't part of this build; collapsed
        // into the same Transactions tab instead of left stale.
        tabs: [
          { key: 'accounts',     label: 'All Accounts',            description: 'Company bank accounts — add/edit, opening balance and date.' },
          { key: 'balance',      label: 'Balance',                 description: 'Current balance per account — opening balance plus computed activity.' },
          { key: 'transactions', label: 'Transactions / Statements', description: 'Running-balance transaction list per account: every linked receipt, contractor/vendor payment, and transfer, in date order.' },
          { key: 'transfers',    label: 'Transfers',               description: 'Transfers between our own accounts — a debit on one statement, a credit on the other.' },
        ],
      },
      {
        to: '/finance/cash-book', icon: faBook, label: 'Cash Book',
        // Real as of the Bank + Cash Book build. A cash-mode receipt or
        // contractor/vendor payment (no bankAccountId set) auto-creates
        // the matching Cash In/Cash Out entry — those show read-only here
        // (edit the originating record instead); the manual add form is
        // only for cash with no originating record (petty cash, owner
        // draws). Opening/Closing has no separate stored balance — it's
        // the running total of every entry before the range, same
        // computed-on-read rule used everywhere else in this build.
        tabs: [
          { key: 'cash-in',  label: 'Cash In',  description: 'Cash received — auto-generated from cash-mode receipts, plus manual entries for petty cash returns etc.' },
          { key: 'cash-out', label: 'Cash Out', description: 'Cash paid out — auto-generated from cash-mode contractor/vendor payments, plus manual entries for petty cash, owner draws, etc.' },
          { key: 'opening-closing', label: 'Opening / Closing', description: 'Opening and closing cash balance for a chosen date range.' },
        ],
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        to: '/finance/reports', icon: faFileExport, label: 'Reports', phase: 'Phase 5',
        // Renamed/repositioned from "Reports & Exports". Bespoke component
        // as of the Reports & Profitability build — every tab except
        // Supervisor Analysis, Labour Analysis, and Reconciliation is real,
        // built entirely as read-only rollups over data every other
        // module already writes (no new writable model anywhere in this
        // module). Material-cost figures (Project Profit, Work Profit,
        // Material Analysis) use weighted-average costing — there's no
        // FIFO/batch-level costing anywhere in this system, so this is an
        // approximation flagged as such in the UI. Project Profit, Client
        // Profit, and Work Profit cross-link each other; Work Profit has
        // no picker of its own — it's only reached by drilling in from a
        // project's Works tab (or from Project Profit's own Works list).
        // Supervisor/Labour Analysis stay placeholder — they depend on
        // modules that don't exist yet (Supervisors, Daily Labour).
        // CA Monthly Package added in the CA Monthly Package + Client Bill
        // Statement build — reads the optional gstRate/gstAmount now on
        // financeRunningBill/financePurchase and the optional
        // tdsSectionId/tdsAmount now on Contractor/Vendor/Commission
        // Payment (all additive, existing records keep working unset).
        // Every Running Bill (Receivables' tabs, a project's own Running
        // Bills tab, and Clients > Bills) also gained a "Statement" action
        // in that same build — downloads a per-bill Client Bill Statement
        // PDF via GET /api/finance/running-bills/:id/statement/download.
        tabs: [
          { key: 'project-profit',       label: 'Project Profit',        description: 'Revenue minus material/contractor/commission cost and other expenses, per project.' },
          { key: 'client-profit',        label: 'Client Profit',         description: 'Same breakdown, rolled up across every project for one client.' },
          { key: 'work-profit',          label: 'Work Profit',           description: "Revenue billed minus contractor and material cost for one work — reached by drilling in from a project's Works tab." },
          { key: 'contractor-analysis',  label: 'Contractor Analysis',   description: 'Earnings, advances, deductions, payments, and balance payable — every labour contractor side by side.' },
          { key: 'vendor-analysis',      label: 'Vendor Analysis',       description: 'Purchases, returns, payments, and amount owed — every material-supplier vendor side by side.' },
          { key: 'material-analysis',    label: 'Material Analysis',     description: 'Purchased, returned, consumed, wasted, current stock, and weighted-average cost per material.' },
          { key: 'cash-flow',            label: 'Cash Flow',             description: 'Total in (receipts) vs. out (contractor/vendor/salary/commission payments + expenses), by category and over a date range.' },
          { key: 'expense-analysis',     label: 'Expense Analysis',      description: 'financeExpense totals grouped by category and project, filterable by date range.' },
          { key: 'ca-monthly-package',   label: 'CA Monthly Package',    description: 'GST, TDS, sales, purchase, expense, and bank/cash summary for one month — downloadable as a PDF for handoff to your CA. Real as of the CA Monthly Package + Client Bill Statement build.' },
          { key: 'supervisor-analysis',  label: 'Supervisor Analysis',   description: 'Area supervised and incentive earned per supervisor.' },
          { key: 'labour-analysis',      label: 'Labour Analysis',       description: 'Labour days and cost per team/work type.' },
          { key: 'reconciliation',       label: 'Reconciliation',        phase: 'Phase 6', description: "Guided month-end checklist — approve entries, settle labour, verify stock, invoice, chase receivables, pay vendors, GST, TDS, review. (Bank statement import/match itself now lives under Bank.)" },
        ],
      },
    ],
  },
  {
    label: 'Setup',
    items: [
      {
        to: '/finance/masters', icon: faUsersGear, label: 'Masters',
        phase: 'Phase 0',
        // Bespoke component. Restructured internally — see MasterData.jsx —
        // but this stays the most complete module: Material Master, Work
        // Types, Payment Modes, Expense Heads, TDS Sections, Employees, and
        // Labour Teams all have full CRUD backing it. Salary Ledger tab
        // added in the Salary + Commission + Other Expenses build — a
        // picker on this same page feeds
        // GET /api/finance/employees/:employeeId/salary-ledger, computed
        // from employee.salary minus financeSalaryPayment for the chosen
        // (or every) month.
        tabs: [{ key: 'overview', label: 'Overview', description: 'Material catalog, work types, payment modes, expense heads, TDS sections, employees, and labour teams.' }],
      },
      {
        to: '/finance/settings', icon: faGear, label: 'Settings',
        // Unrelated to the dissolved "Settings & Lists" master-data tab —
        // this is system-level configuration, nothing built yet.
        tabs: [
          { key: 'fy',            label: 'Financial Year',  description: 'Financial year start/end and locking.' },
          { key: 'company',       label: 'Company',         description: 'Company profile — name, address, GST, logo.' },
          { key: 'permissions',   label: 'Permissions',     description: 'Role-level access control.' },
          { key: 'gst',           label: 'GST',             description: 'GST rates and defaults.' },
          { key: 'notifications', label: 'Notifications',   description: 'Email/WhatsApp notification preferences.' },
          { key: 'pdf',           label: 'PDF Templates',   description: 'Client bill and CA-package PDF templates.' },
          { key: 'backup',        label: 'Backup',          description: 'Data export/backup.' },
        ],
      },
    ],
  },
];

/*
 * Old → new mapping (for anyone diffing against the previous 13-page nav):
 *
 *   Dashboard ('/finance')              → Dashboard (unchanged)
 *   Dashboards (Phase 4 placeholder)    → merged into Dashboard, removed as its own entry
 *   All Projects / New Project          → Projects (unchanged)
 *   Master Data → Clients               → Clients (own top-level page)                    [bespoke: ClientsPage]
 *   Master Data → Vendors               → Procurement > Vendors (filtered, non-contractor) [bespoke: ProcurementPage]
 *                                          + Contractors > Overview (filtered, contractor)  [bespoke: ContractorsPage]
 *   Master Data → Employees             → Masters > Employees (unchanged)
 *   Master Data → Materials             → Masters > Material Master
 *   Master Data → Labour Teams          → Masters > Labour Teams (unchanged)
 *   Master Data → Settings & Lists      → Masters > Work Types / Payment Modes / Expense Heads / TDS Sections
 *   Daily Site Entry (Phase 1)          → Site Operations
 *   Month-End Settlements (Phase 2)     → Contractors > Settlements + Supervisors > Incentives
 *   Sales Register (Phase 3)            → Receivables
 *   Purchase Register (Phase 3)         → Procurement > Purchases
 *   Payments (Phase 3)                  → Payments (own top-level, unchanged position)
 *   Quotations (Phase 3)                → Clients > Quotations
 *   Reports & Exports (Phase 5)         → Reports
 *   Reconciliation (Phase 6)            → Bank (own top-level) + Reports > Reconciliation
 *
 * Bespoke (non-FinancePage) routes: /finance, /finance/clients, /finance/clients/:id,
 * /finance/projects, /finance/projects/new, /finance/projects/:id, /finance/procurement,
 * /finance/contractors, /finance/masters — see App.jsx's exclusion filter.
 */

/* Flattened, for route generation in App.jsx and the FinanceHome shortcut cards.
   Items inherit their section's `phase` unless they set their own (mirrors the
   original file's behavior — most sections mix phases now, so most items set
   their own). */
export const FINANCE_ROUTES = FINANCE_NAV_SECTIONS.flatMap(({ phase: sectionPhase, items }) =>
  items.map(({ to, icon, label, phase, tabs }) => ({ to, icon, label, phase: phase || sectionPhase, tabs }))
);
