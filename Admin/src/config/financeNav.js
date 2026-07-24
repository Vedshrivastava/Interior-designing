import {
  faGaugeHigh, faClockRotateLeft, faUserTie, faBuilding, faCirclePlus,
  faClipboardList, faCartShopping, faWarehouse, faHardHat,
  faPersonDigging, faHandshake, faFileInvoiceDollar, faReceipt, faMoneyBillWave,
  faMoneyBillTransfer, faBuildingColumns, faBook, faFileExport, faUsersGear,
  faGear, faTrashCan, faUsers,
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
        tabs: [{ key: 'overview', label: 'Overview', description: 'Finance home: shortcuts into every section below.' }],
      },
      {
        to: '/finance/activity', icon: faClockRotateLeft, label: 'Activity Timeline',
        tabs: [{ key: 'timeline', label: 'Timeline', description: 'Chronological log of every create/update/delete across the finance workspace: who did what, when. No audit-trail mechanism exists in the backend yet.' }],
      },
    ],
  },
  {
    label: 'Clients',
    items: [
      {
        to: '/finance/clients', icon: faUserTie, label: 'Clients',
        // Relocated out of Master Data — was the "Clients" tab there.
        tabs: [{ key: 'list', label: 'List', description: "Client master: name, contact, billing details. Each client opens into its own detail view." }],
      },
    ],
  },
  {
    label: 'Projects',
    phase: 'Phase 0.5',
    items: [
      {
        to: '/finance/projects', icon: faBuilding, label: 'All Projects',
        tabs: [{ key: 'list', label: 'List', description: 'Project list with filters: links out to the New Project wizard or a project\'s detail page.' }],
      },
      {
        to: '/finance/projects/new', icon: faCirclePlus, label: 'New Project',
        tabs: [{ key: 'wizard', label: 'Wizard', description: 'Guided 6-step setup: basic info, contract type, conditional rate setup, contractor assignment, and, for Advance contracts, the upfront payment.' }],
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
          { key: 'measurements', label: 'Daily Measurements',   description: 'Mobile-first site entry: project, work, supervisor, area covered, materials used. Saving updates the work\'s completed area and (if material tracking is on) logs stock consumption automatically.' },
          { key: 'consumption',  label: 'Material Consumption', description: 'Read-only log of material consumed, generated only by measurement saves.' },
          { key: 'diary',        label: 'Site Diary',           description: 'Daily site notes and an open/resolved issues log, per project.' },
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
        tabs: [{ key: 'vendors', label: 'Vendors', description: 'Material suppliers and other non-contractor vendors: labour contractors live under Contractors instead.' }],
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
        // Measurements are real too, resolved directly via this vendor's
        // work-contractor assignments — no separate Team concept.
        tabs: [{ key: 'overview', label: 'Overview', description: 'Vendors with type Labour Contractor.' }],
      },
      {
        to: '/finance/employees', icon: faUsers, label: 'Employees',
        // Replaces the old standalone Supervisors page (removed) — a
        // Supervisor is a financeEmployee (no separate model; role decides
        // which sections apply, not a dedicated model/route). Directory tab
        // is the exact same MasterCrudTable Masters used to render for the
        // 'employees' tab (add/edit/delete, full field set including Role);
        // every other tab is a "pick one employee" section page. Role
        // (Supervisor/Staff) decides which supervisor-shaped sections
        // (Assigned Projects/Team/Labour Ledger) actually show,
        // since those key off data only a supervisor has — and a single
        // supervisor can independently hold BOTH of two designations at
        // once: "project supervisor" (financeProject.assignedSupervisorId,
        // surfaced in Assigned Projects — one supervisor overseeing a whole
        // project) and "labour supervisor" (work-labour-assignment's
        // supervisorId, surfaced in Team/Labour Ledger — running one
        // Work's labour team specifically). These are independent
        // relationships, not mutually exclusive, and both are scoped by
        // employeeId only — same employee, same tabs, whichever
        // relationships exist for them.
        // `assignedSupervisor` on financeProject stays a plain string for
        // old projects; new/edited projects populate `assignedSupervisorId`
        // (ref financeEmployee) instead — Assigned Projects matches on the
        // ref first, falling back to a name match against the legacy
        // string so old projects don't just disappear from the list.
        tabs: [
          { key: 'directory',   label: 'Directory',         description: 'Employee master: name, role (Supervisor/Staff), designation, salary, bank details. Add/edit/delete here.' },
          { key: 'projects',    label: 'Assigned Projects', description: 'Supervisors only — projects whose assignedSupervisorId (or legacy assignedSupervisor string) matches this employee.' },
          { key: 'team',        label: 'Team',               description: "Supervisors only — labourers currently on this supervisor's team, across every Work." },
          { key: 'labour',      label: 'Labour Ledger',      description: "Supervisors only — pick a labourer from this supervisor's team to view their earnings/advances/deductions/payments ledger." },
          { key: 'attendance',  label: 'Attendance',         description: 'Present / absent / half-day / leave, per day, for this employee.' },
          { key: 'salary',      label: 'Salary',             description: 'Expected salary minus salary payments made, by month, for this employee.' },
          { key: 'incentives',  label: 'Incentives',         description: 'Discretionary payouts on top of salary.' },
          { key: 'deductions',  label: 'Deductions',         description: 'Manual cuts against salary.' },
          { key: 'documents',   label: 'Documents',          description: "This employee's uploaded documents." },
        ],
      },
      {
        to: '/finance/daily-labour', icon: faPersonDigging, label: 'Labourers',
        // Bespoke component — restructured to mirror Contractors' page
        // (picker + Overview/Projects/Works/Measurements/Ledger/Documents),
        // adapted for individual labourers instead of vendors. Each
        // labourer is hired directly by the company and paid per sqft
        // (financeLabourRate, per project + work type) — not a day rate. A
        // supervisor logs each labourer's daily measured area against a
        // Work; no per-entry approval gate, every logged sqft counts
        // toward earnings, and correction (an engineer's periodic review,
        // or a supervisor catching a mistake on the spot) happens
        // afterward as a deduction on that labourer's own ledger. Feeds
        // into Reports > Project Profit as its own Labour Cost line. "All
        // Entries" stays the original unscoped global entry form + list —
        // same LabourMeasurementsManager component a project's own Labour
        // tab reuses.
        tabs: [{ key: 'entries', label: 'All Entries', description: 'Every labour measurement across every project: entry form + filterable list, plus a per-labourer Overview/Projects/Works/Measurements/Ledger/Documents view.' }],
      },
      {
        to: '/finance/referrals', icon: faHandshake, label: 'Referrals',
        // Bespoke component. Relocated out of Procurement (a referral isn't
        // a vendor, doesn't fit under "material vendors and purchasing" any
        // more than Labour Contractors did before they got their own
        // Contractors page) — own top-level People page instead, same
        // picker + ledger shape as Contractors/Labourers. Commission Ledger
        // tab unchanged: financeWork completedAreaSqft × financeWorkTypeRate's
        // referralRatePerSqft across the projects this referral brought in,
        // minus financeCommissionPayment payments.
        tabs: [
          { key: 'overview',         label: 'Overview',          description: 'Referral master: name, contact, bank details, commission type (descriptive only).' },
          { key: 'commissionLedger', label: 'Commission Ledger', description: "Pick a referral to view their earnings, payments, and commission payable." },
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
          { key: 'running-bills',    label: 'Running Bills',     description: "Every bill for a project, draft and issued, with a Generate Bill flow that previews line items before confirming." },
          { key: 'pending-bills',    label: 'Pending Bills',     description: 'Bills generated but not yet issued (draft status).' },
          { key: 'approved-bills',   label: 'Approved Bills',    description: 'Bills issued to the client.' },
          { key: 'pending-receipts', label: 'Pending Receipts',  description: 'Every project with an issued bill and a positive outstanding balance, oldest bill first.' },
        ],
      },
      {
        to: '/finance/receipts', icon: faReceipt, label: 'Receipts',
        tabs: [{ key: 'received', label: 'Money Received', description: 'Client payments received: entry form and history, filterable by project.' }],
      },
      {
        to: '/finance/payables', icon: faMoneyBillWave, label: 'Payables',
        // Bespoke component. Contractor tab pulls balancePayable from
        // GET /api/finance/contractors/:vendorId/ledger (Contractor Ledger
        // build); Vendor tab pulls amountOwed from
        // GET /api/finance/vendors/:vendorId/ledger (Procurement build);
        // Salary tab pulls balanceDue per employee for the current month
        // from GET /api/finance/employees/:employeeId/salary-ledger;
        // Commission tab pulls commissionPayable per referral vendor from
        // GET /api/finance/vendors/:vendorId/commission-ledger. Payables
        // stays COMPUTED throughout — no "financePayable" model exists
        // anywhere; every tab is a read of another collection's ledger.
        // Expenses / Expense Analysis / Company Expenses / Other Expenses
        // are the exception — all four are ExpensesManager (or
        // ExpenseAnalysisView) reads of financeExpense, not a ledger.
        // Expenses had a dedicated top-level sidebar entry briefly; folded
        // back in here since Payables was always meant to be the one home
        // for every payable/expense concept. Company Expenses/Other
        // Expenses are ExpensesManager pre-filtered (fixedRelatedTo: the
        // company singleton / fixedCategory: 'Others') — the two shapes
        // someone reaches for most: a director's hotel stay tagged
        // straight to the company, or a stray receipt with no real
        // category, neither needing the full Work/Related To form.
        tabs: [
          { key: 'vendor',            label: 'Vendor',            description: 'Amount owed per vendor: purchases minus returns and payments already made.' },
          { key: 'contractor',        label: 'Contractor',        description: 'Balance payable per contractor: earnings minus advances, deductions, and payments already made.' },
          { key: 'salary',            label: 'Salary',            description: 'Balance due per employee for the current month: expected salary minus salary payments made.' },
          { key: 'commission',        label: 'Commission',        description: 'Commission payable per referral vendor: earned commission minus payments already made.' },
          { key: 'expenses',          label: 'Expenses',          description: 'Every general/site expense: entry form and full history, paid now or settled later.' },
          { key: 'expense-analysis',  label: 'Expense Analysis',  description: 'Totalled by category, project, work, and person/entity.' },
          { key: 'company',           label: 'Company Expenses',  description: 'Expenses tied to the company itself: director travel, hotel stays, and similar.' },
          { key: 'other',             label: 'Other Expenses',    description: 'Quick, unlinked expenses under the "Others" category: just an amount, date, and note.' },
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
        // Expenses > Log). All three auto-create a financeCashEntry when
        // no bankAccountId is set, same bank/cash automation as every
        // other payment type.
        tabs: [
          { key: 'vendor',     label: 'Vendor Payment',     description: 'Payments made to material vendors: entry form and history.' },
          { key: 'contractor', label: 'Contractor Payment', description: 'Payments made to labour contractors: entry form and history.' },
          { key: 'salary',     label: 'Salary',             description: 'Salary payouts to employees, by month.' },
          { key: 'commission', label: 'Commission',         description: 'Referral commission payouts to referral-type vendors.' },
          { key: 'misc',       label: 'Miscellaneous',      description: 'Any other outgoing payment: general company/site expenses.' },
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
          { key: 'accounts',     label: 'All Accounts',            description: 'Company bank accounts: add/edit, opening balance and date.' },
          { key: 'balance',      label: 'Balance',                 description: 'Current balance per account: opening balance plus computed activity.' },
          { key: 'transactions', label: 'Transactions / Statements', description: 'Running-balance transaction list per account: every linked receipt, contractor/vendor payment, and transfer, in date order.' },
          { key: 'transfers',    label: 'Transfers',               description: 'Transfers between our own accounts: a debit on one statement, a credit on the other.' },
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
          { key: 'cash-in',  label: 'Cash In',  description: 'Cash received: auto-generated from cash-mode receipts, plus manual entries for petty cash returns etc.' },
          { key: 'cash-out', label: 'Cash Out', description: 'Cash paid out: auto-generated from cash-mode contractor/vendor payments, plus manual entries for petty cash, owner draws, etc.' },
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
        // Supervisor/Labour Analysis stay placeholder — no aggregation
        // built for them yet, even though Supervisors and Labour
        // themselves are both real.
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
          { key: 'project-profit',       label: 'Project Profit',        description: 'Revenue minus material/contractor/commission/labour cost and other expenses, per project.' },
          { key: 'client-profit',        label: 'Client Profit',         description: 'Same breakdown, rolled up across every project for one client.' },
          { key: 'work-profit',          label: 'Work Profit',           description: "Revenue billed minus contractor and material cost for one work: reached by drilling in from a project's Works tab." },
          { key: 'contractor-analysis',  label: 'Contractor Analysis',   description: 'Earnings, advances, deductions, payments, and balance payable: every labour contractor side by side.' },
          { key: 'vendor-analysis',      label: 'Vendor Analysis',       description: 'Purchases, returns, payments, and amount owed: every material-supplier vendor side by side.' },
          { key: 'material-analysis',    label: 'Material Analysis',     description: 'Purchased, returned, consumed, wasted, current stock, and weighted-average cost per material.' },
          { key: 'cash-flow',            label: 'Cash Flow',             description: 'Total in (receipts) vs. out (contractor/vendor/salary/commission payments + expenses), by category and over a date range.' },
          { key: 'expense-analysis',     label: 'Expense Analysis',      description: 'financeExpense totals grouped by category and project, filterable by date range.' },
          { key: 'ca-monthly-package',   label: 'CA Monthly Package',    description: 'GST, TDS, sales, purchase, expense, and bank/cash summary for one month: downloadable as a PDF for handoff to your CA. Real as of the CA Monthly Package + Client Bill Statement build.' },
          { key: 'supervisor-analysis',  label: 'Supervisor Analysis',   description: 'Area supervised and incentive earned per supervisor.' },
          { key: 'labour-analysis',      label: 'Labour Analysis',       description: 'Labour days and cost per team/work type.' },
          { key: 'reconciliation',       label: 'Reconciliation',        phase: 'Phase 6', description: "Guided month-end checklist: approve entries, settle labour, verify stock, invoice, chase receivables, pay vendors, GST, TDS, review. (Bank statement import/match itself now lives under Bank.)" },
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
        // and now the most complete module by far: Material Master, Work
        // Types, Payment Modes, Expense Heads, TDS Sections, Units, Cities,
        // Commission Types, and Employees all have full CRUD backing them
        // (Contractor Teams was collapsed directly into Vendors — a
        // contractor is just a vendor now, no separate Team master).
        // Salary Ledger tab added in the Salary + Commission
        // + Other Expenses build — a picker on this same page feeds
        // GET /api/finance/employees/:employeeId/salary-ledger, computed
        // from employee.salary minus financeSalaryPayment for the chosen
        // (or every) month.
        //
        // Units/Cities/Commission Types went real in the Masters
        // Completion build, same generic financeSetting CRUD as the
        // original four — Units back a dropdown-with-escape-hatch on the
        // Material form's `unit` field, Cities the same on a project's
        // `siteLocation` field (both stay plain Strings, never validated
        // against the master — old free-text values keep working), and
        // Commission Types back an optional, purely descriptive
        // `commissionTypeLabel` on a referral that has zero effect
        // on the actual commission math (still always
        // completedAreaSqft × referralRatePerSqft). The Banks placeholder
        // tab was removed in that same build — Bank Accounts already
        // exists for real under its own top-level Bank section.
        tabs: [{ key: 'overview', label: 'Overview', description: 'Material catalog, work types, payment modes, expense heads, TDS sections, units, cities, commission types, and employees.' }],
      },
      {
        to: '/finance/settings', icon: faGear, label: 'Settings',
        // Bespoke component, real as of the Settings build — every tab
        // backed by the financeCompanySettings singleton (Company/GST/
        // Notifications/PDF Templates all edit the same one document,
        // just split into tabs) except Permissions, which edits
        // user.allowedFinanceModules on ADMIN users instead. The
        // Financial Year tab was removed (never wired to anything
        // downstream — see the Settings redesign build).
        tabs: [
          { key: 'company',       label: 'Company',         description: 'Company profile: name, address, GSTIN, PAN, logo. Used as real branding on the CA Monthly Package and Client Bill Statement PDFs.' },
          { key: 'permissions',   label: 'Permissions',     description: 'MASTER-only: which finance sidebar sections each ADMIN user can access. Unrestricted by default; MASTER always has full access.' },
          { key: 'gst',           label: 'GST',             description: 'defaultGstRate: prefills (not locks) the GST rate field on Running Bill / Purchase entry forms.' },
          { key: 'notifications', label: 'Notifications',   description: 'Notification email list + low-stock and overdue-receivable alert toggles/thresholds. Checked on Dashboard load, not a background job.' },
          { key: 'pdf',           label: 'PDF Templates',   description: 'letterheadFooterText for generated PDFs. The brand color palette is fixed in code, not editable here.' },
          { key: 'backup',        label: 'Backup',          description: 'Export every finance collection as one zip of JSON files.' },
        ],
      },
      {
        to: '/finance/recovery-bin', icon: faTrashCan, label: 'Recovery Bin',
        // Bespoke component. Finance's own soft-delete trash — deliberately
        // separate from the main Dashboard's Recovery Bin (public-site
        // content only, see pages/RecoveryBin.jsx): covers exactly the 12
        // Finance entities whose own list pages promise "Moved to Recovery
        // Bin" on delete (Clients, Vendors, Employees, Labourers,
        // Materials, Bank Accounts, Projects, Works, Running Bills,
        // Purchases, Client/Project Documents). MASTER-only.
        tabs: [{ key: 'bin', label: 'Bin', description: 'Restore a soft-deleted Finance record or remove it for good.' }],
      },
    ],
  },
];

/*
 * Derives the finance-module key used by allowedFinanceModules from a
 * route path — the first path segment after /finance (e.g.
 * '/finance/clients/507f...' → 'clients', '/finance/projects/new' →
 * 'projects', '/finance' itself → 'dashboard'). Shared by sidebar.jsx
 * (hides restricted sections) and ProtectedRoute.jsx (blocks the route
 * directly) so the two can never drift out of sync with each other.
 */
export const financeModuleKeyForPath = (pathname) => {
  if (!pathname || !pathname.startsWith('/finance')) return null;
  const rest = pathname.slice('/finance'.length);
  if (!rest || rest === '/') return 'dashboard';
  const firstSegment = rest.split('/').filter(Boolean)[0];
  return firstSegment || 'dashboard';
};

/*
 * Old → new mapping (for anyone diffing against the previous 13-page nav):
 *
 *   Dashboard ('/finance')              → Dashboard (unchanged)
 *   Dashboards (Phase 4 placeholder)    → merged into Dashboard, removed as its own entry
 *   All Projects / New Project          → Projects (unchanged)
 *   Master Data → Clients               → Clients (own top-level page)                    [bespoke: ClientsPage]
 *   Master Data → Vendors               → Procurement > Vendors (filtered, non-contractor) [bespoke: ProcurementPage]
 *                                          + Contractors > Overview (filtered, contractor)  [bespoke: ContractorsPage]
 *   Master Data → Employees             → People > Employees (moved out of Masters entirely; Supervisors' old standalone page was later folded in here too)
 *   Master Data → Materials             → Masters > Material Master
 *   Master Data → Labour Teams          → collapsed into Vendors (a contractor is a vendor, no separate Team master)
 *   Master Data → Settings & Lists      → Masters > Work Types / Payment Modes / Expense Heads / TDS Sections
 *   Daily Site Entry (Phase 1)          → Site Operations
 *   Month-End Settlements (Phase 2)     → Contractors > Settlements + Employees > Incentives
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

/* { key, label } per finance module, deduped — feeds Settings > Permissions'
   multi-select of which sections a restricted ADMIN user can reach. */
export const FINANCE_MODULE_OPTIONS = [...new Map(
  [{ to: '/finance', label: 'Dashboard' }, ...FINANCE_ROUTES]
    .map(r => [financeModuleKeyForPath(r.to), r.label])
).entries()].map(([key, label]) => ({ key, label }));

/* { key, to } per finance module, deduped, in sidebar order — ProtectedRoute
   uses this to find a restricted user's first allowed module instead of
   bouncing everyone to a hardcoded path that could itself be off-limits. */
export const FINANCE_MODULE_PATHS = [...new Map(
  [{ to: '/finance', label: 'Dashboard' }, ...FINANCE_ROUTES]
    .map(r => [financeModuleKeyForPath(r.to), r.to])
).entries()].map(([key, to]) => ({ key, to }));
