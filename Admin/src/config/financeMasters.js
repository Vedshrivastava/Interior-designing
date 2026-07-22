/*
 * Field + column config for each Phase 0 master, driving the generic
 * MasterCrudTable component. One config per resource instead of five
 * near-identical bespoke CRUD pages.
 */
export const FINANCE_MASTERS = {
    clients: {
        label: 'Client', labelPlural: 'Clients', apiBase: '/api/finance/clients',
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true, section: 'Contact' },
            { key: 'phone', label: 'Phone', type: 'tel', section: 'Contact' },
            { key: 'email', label: 'Email', type: 'email', section: 'Contact' },
            { key: 'address', label: 'Address', type: 'textarea', section: 'Contact' },
            { key: 'gstNumber', label: 'GSTIN (if GST-registered)', type: 'text', section: 'Contact' },
            { key: 'accountName', label: 'Bank Account Holder Name', type: 'text', required: true, section: 'Bank Details' },
            { key: 'bankName', label: 'Bank Name', type: 'text', required: true, section: 'Bank Details' },
            { key: 'accountNumber', label: 'Account Number', type: 'text', required: true, section: 'Bank Details' },
            { key: 'confirmAccountNumber', label: 'Re-enter Account Number', type: 'confirmText', matchKey: 'accountNumber', required: true, placeholder: 'Retype to confirm', section: 'Bank Details' },
            { key: 'ifscCode', label: 'IFSC Code', type: 'text', required: true, section: 'Bank Details' },
            { key: 'notes', label: 'Notes', type: 'textarea', section: 'Other' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
        ],
    },
    // "Vendor" only ever means someone the studio purchases material from,
    // or a labour contractor company — Referral and Labour Provider used
    // to be vendorType values here too, but neither is someone the studio
    // buys anything from, so they're their own resources entirely now
    // (see `referrals` and `labourProviders` below).
    vendors: {
        label: 'Vendor', labelPlural: 'Vendors', apiBase: '/api/finance/vendors',
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true, section: 'Contact' },
            {
                key: 'vendorType', label: 'Vendor Type', type: 'select', default: 'other', section: 'Contact',
                options: [
                    { value: 'material_supplier', label: 'Material Supplier' },
                    { value: 'labour_contractor', label: 'Labour Contractor' },
                    { value: 'other', label: 'Other' },
                ],
            },
            { key: 'phone', label: 'Phone', type: 'tel', section: 'Contact' },
            { key: 'email', label: 'Email', type: 'email', section: 'Contact' },
            { key: 'address', label: 'Address', type: 'textarea', section: 'Contact' },
            { key: 'gstNumber', label: 'GSTIN (if GST-registered)', type: 'text', section: 'Contact' },
            { key: 'accountName', label: 'Bank Account Holder Name', type: 'text', required: true, section: 'Bank Details' },
            { key: 'bankName', label: 'Bank Name', type: 'text', required: true, section: 'Bank Details' },
            { key: 'accountNumber', label: 'Account Number', type: 'text', required: true, section: 'Bank Details' },
            { key: 'confirmAccountNumber', label: 'Re-enter Account Number', type: 'confirmText', matchKey: 'accountNumber', required: true, placeholder: 'Retype to confirm', section: 'Bank Details' },
            { key: 'ifscCode', label: 'IFSC Code', type: 'text', required: true, section: 'Bank Details' },
            { key: 'notes', label: 'Notes', type: 'textarea', section: 'Other' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'vendorType', label: 'Type', badge: true },
            { key: 'phone', label: 'Phone' },
        ],
    },
    // A referral person/entity that earns a commission (area × a work
    // type's referral rate) for projects they bring in — its own
    // collection (financeReferral), not a vendor: not someone the studio
    // purchases anything from.
    referrals: {
        label: 'Referral', labelPlural: 'Referrals', apiBase: '/api/finance/referrals',
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true, section: 'Contact' },
            { key: 'phone', label: 'Phone', type: 'tel', section: 'Contact' },
            { key: 'email', label: 'Email', type: 'email', section: 'Contact' },
            { key: 'address', label: 'Address', type: 'textarea', section: 'Contact' },
            { key: 'gstNumber', label: 'GSTIN (if GST-registered)', type: 'text', section: 'Contact' },
            { key: 'accountName', label: 'Bank Account Holder Name', type: 'text', required: true, section: 'Bank Details' },
            { key: 'bankName', label: 'Bank Name', type: 'text', required: true, section: 'Bank Details' },
            { key: 'accountNumber', label: 'Account Number', type: 'text', required: true, section: 'Bank Details' },
            { key: 'confirmAccountNumber', label: 'Re-enter Account Number', type: 'confirmText', matchKey: 'accountNumber', required: true, placeholder: 'Retype to confirm', section: 'Bank Details' },
            { key: 'ifscCode', label: 'IFSC Code', type: 'text', required: true, section: 'Bank Details' },
            {
                key: 'commissionTypeLabel', label: 'Commission Type', type: 'settingSelect', settingType: 'commission_type',
                placeholder: 'e.g. Flat, Tiered, Project-based…', section: 'Commission',
                note: 'Descriptive only: does not change how commission is calculated. Commission is always area × the work type\'s referral rate per sqft.',
            },
            { key: 'notes', label: 'Notes', type: 'textarea', section: 'Other' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'phone', label: 'Phone' },
        ],
    },
    // A middleman who supplies/connects labourers, earning a fixed ₹/sqft
    // cut on each connected labourer's own reviewed sqft — its own
    // collection (financeLabourProvider), not a vendor. Surfaced both as
    // its own Masters tab and via the Labourer form's "+ Add New".
    labourProviders: {
        label: 'Labour Provider', labelPlural: 'Labour Providers', apiBase: '/api/finance/labour-providers',
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true, section: 'Contact' },
            { key: 'phone', label: 'Phone', type: 'tel', section: 'Contact' },
            { key: 'email', label: 'Email', type: 'email', section: 'Contact' },
            { key: 'address', label: 'Address', type: 'textarea', section: 'Contact' },
            { key: 'gstNumber', label: 'GSTIN (if GST-registered)', type: 'text', section: 'Contact' },
            { key: 'accountName', label: 'Bank Account Holder Name', type: 'text', required: true, section: 'Bank Details' },
            { key: 'bankName', label: 'Bank Name', type: 'text', required: true, section: 'Bank Details' },
            { key: 'accountNumber', label: 'Account Number', type: 'text', required: true, section: 'Bank Details' },
            { key: 'confirmAccountNumber', label: 'Re-enter Account Number', type: 'confirmText', matchKey: 'accountNumber', required: true, placeholder: 'Retype to confirm', section: 'Bank Details' },
            { key: 'ifscCode', label: 'IFSC Code', type: 'text', required: true, section: 'Bank Details' },
            { key: 'notes', label: 'Notes', type: 'textarea', section: 'Other' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'phone', label: 'Phone' },
        ],
    },
    employees: {
        label: 'Employee', labelPlural: 'Employees', apiBase: '/api/finance/employees',
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true, section: 'Details' },
            {
                key: 'role', label: 'Role', type: 'select', default: 'staff', section: 'Details',
                options: [
                    { value: 'supervisor', label: 'Supervisor' },
                    { value: 'staff', label: 'Staff' },
                ],
            },
            { key: 'designation', label: 'Designation', type: 'text', placeholder: 'e.g. Site Supervisor, Data Entry, Social Media', section: 'Details' },
            { key: 'phone', label: 'Phone', type: 'tel', section: 'Details' },
            { key: 'email', label: 'Email', type: 'email', section: 'Details' },
            { key: 'salary', label: 'Salary (₹/month)', type: 'number', section: 'Details' },
            { key: 'joiningDate', label: 'Joining Date', type: 'date', section: 'Details' },
            { key: 'accountName', label: 'Bank Account Holder Name', type: 'text', required: true, section: 'Bank Details' },
            { key: 'bankName', label: 'Bank Name', type: 'text', required: true, section: 'Bank Details' },
            { key: 'accountNumber', label: 'Account Number', type: 'text', required: true, section: 'Bank Details' },
            { key: 'confirmAccountNumber', label: 'Re-enter Account Number', type: 'confirmText', matchKey: 'accountNumber', required: true, placeholder: 'Retype to confirm', section: 'Bank Details' },
            { key: 'ifscCode', label: 'IFSC Code', type: 'text', required: true, section: 'Bank Details' },
            { key: 'notes', label: 'Notes', type: 'textarea', section: 'Other' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'role', label: 'Role', badge: true },
            { key: 'designation', label: 'Designation' },
            { key: 'phone', label: 'Phone' },
        ],
    },
    materials: {
        label: 'Material', labelPlural: 'Materials', apiBase: '/api/finance/materials',
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'unit', label: 'Unit', type: 'settingSelect', settingType: 'unit', placeholder: 'bag, sqft, kg, piece…' },
            { key: 'minimumStockLevel', label: 'Minimum Stock Level', type: 'number' },
            { key: 'workTypes', label: 'Applicable Work Types (leave empty for all)', type: 'workTypeMultiSelect', settingType: 'work_type' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'unit', label: 'Unit' },
            { key: 'minimumStockLevel', label: 'Min. Stock' },
            { key: 'workTypes', label: 'Work Types', joinArray: true, emptyLabel: 'All' },
        ],
    },
    // A plain, company-wide name — not owned by any supervisor. Which
    // supervisor runs a labourer's crew is a fact about a specific Work
    // assignment (financeWorkLabourAssignment.supervisorId), decided fresh
    // each time, not about the labourer themselves. Surfaced both as its
    // own Masters tab (this entry) and via LabourMultiSelect/LabourPicker's
    // "+ Add New" wherever a Work's labour team or a Workers rate row
    // needs to create one on the fly.
    labourers: {
        label: 'Labourer', labelPlural: 'Labourers', apiBase: '/api/finance/labourers',
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            {
                key: 'labourProviderId', label: 'Labour Provider (optional)', type: 'resourceSelect', resourceKey: 'labourProviders',
                section: 'Labour Provider',
            },
            {
                key: 'labourProviderRatePerSqft', label: 'Labour Provider Rate (₹/sqft) *', type: 'number', section: 'Labour Provider',
                showIf: (form) => !!form.labourProviderId,
                note: "A separate cost paid to the provider, based on this labourer's reviewed sqft. Never deducted from their own pay.",
            },
            { key: 'accountName', label: 'Bank Account Holder Name', type: 'text', required: true, section: 'Bank Details' },
            { key: 'bankName', label: 'Bank Name', type: 'text', required: true, section: 'Bank Details' },
            { key: 'accountNumber', label: 'Account Number', type: 'text', required: true, section: 'Bank Details' },
            { key: 'confirmAccountNumber', label: 'Re-enter Account Number', type: 'confirmText', matchKey: 'accountNumber', required: true, placeholder: 'Retype to confirm', section: 'Bank Details' },
            { key: 'ifscCode', label: 'IFSC Code', type: 'text', required: true, section: 'Bank Details' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'labourProviderId', label: 'Labour Provider', refResource: 'labourProviders' },
        ],
    },
    // Not surfaced under Masters' own page — reused from the Bank page's
    // "All Accounts" tab instead, same MasterCrudTable component, since its
    // add/list/edit/remove shape is identical to every master above.
    bankAccounts: {
        label: 'Bank Account', labelPlural: 'Bank Accounts', apiBase: '/api/finance/bank-accounts',
        fields: [
            { key: 'accountName', label: 'Account Name', type: 'text', required: true },
            { key: 'bankName', label: 'Bank Name', type: 'text', required: true },
            { key: 'accountNumber', label: 'Account Number', type: 'text' },
            { key: 'ifscCode', label: 'IFSC Code', type: 'text' },
            { key: 'accountType', label: 'Account Type', type: 'text', placeholder: 'Current, Savings…' },
            { key: 'openingBalance', label: 'Opening Balance (₹)', type: 'number', required: true },
            { key: 'openingBalanceDate', label: 'Opening Balance Date', type: 'date', required: true },
            { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        columns: [
            { key: 'accountName', label: 'Account Name' },
            { key: 'bankName', label: 'Bank' },
            { key: 'accountNumber', label: 'Account No.' },
        ],
    },
};

/* Settings & Lists tab — categorized simple lists (name + optional code/rate) */
export const FINANCE_SETTING_TYPES = [
    { key: 'work_type', label: 'Work Types', hasCode: false, hasRate: false },
    { key: 'expense_category', label: 'Expense Categories', hasCode: false, hasRate: false },
    { key: 'payment_mode', label: 'Payment Modes', hasCode: false, hasRate: false },
    { key: 'tds_section', label: 'TDS Sections', hasCode: true, hasRate: true },
    { key: 'unit', label: 'Units', hasCode: false, hasRate: false },
    { key: 'city', label: 'Cities', hasCode: false, hasRate: false },
    { key: 'commission_type', label: 'Commission Types', hasCode: false, hasRate: false },
];
