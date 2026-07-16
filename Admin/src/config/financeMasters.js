/*
 * Field + column config for each Phase 0 master, driving the generic
 * MasterCrudTable component. One config per resource instead of five
 * near-identical bespoke CRUD pages.
 */
export const FINANCE_MASTERS = {
    clients: {
        label: 'Client', labelPlural: 'Clients', apiBase: '/api/finance/clients',
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'phone', label: 'Phone', type: 'tel' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'address', label: 'Address', type: 'textarea' },
            { key: 'gstNumber', label: 'GST Number', type: 'text' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
        ],
    },
    vendors: {
        label: 'Vendor', labelPlural: 'Vendors', apiBase: '/api/finance/vendors',
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            {
                key: 'vendorType', label: 'Vendor Type', type: 'select', default: 'other',
                options: [
                    { value: 'material_supplier', label: 'Material Supplier' },
                    { value: 'labour_contractor', label: 'Labour Contractor' },
                    { value: 'referral', label: 'Referral' },
                    { value: 'other', label: 'Other' },
                ],
            },
            { key: 'phone', label: 'Phone', type: 'tel' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'address', label: 'Address', type: 'textarea' },
            { key: 'gstNumber', label: 'GST Number', type: 'text' },
            {
                key: 'commissionTypeLabel', label: 'Commission Type', type: 'settingSelect', settingType: 'commission_type',
                placeholder: 'e.g. Flat, Tiered, Project-based…',
                showIf: (form) => form.vendorType === 'referral',
                note: 'Descriptive only — does not change how commission is calculated. Commission is always area × the work type\'s referral rate per sqft.',
            },
            { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'vendorType', label: 'Type', badge: true },
            { key: 'phone', label: 'Phone' },
        ],
    },
    employees: {
        label: 'Employee', labelPlural: 'Employees', apiBase: '/api/finance/employees',
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'designation', label: 'Designation', type: 'text' },
            { key: 'phone', label: 'Phone', type: 'tel' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'salary', label: 'Salary (₹/month)', type: 'number' },
            { key: 'joiningDate', label: 'Joining Date', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
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
            { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'unit', label: 'Unit' },
            { key: 'minimumStockLevel', label: 'Min. Stock' },
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
            { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
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
