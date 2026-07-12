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
            { key: 'unit', label: 'Unit', type: 'text', placeholder: 'bag, sqft, kg, piece…' },
            { key: 'minimumStockLevel', label: 'Minimum Stock Level', type: 'number' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'unit', label: 'Unit' },
            { key: 'minimumStockLevel', label: 'Min. Stock' },
        ],
    },
    teams: {
        label: 'Team', labelPlural: 'Labour Teams', apiBase: '/api/finance/teams',
        fields: [
            { key: 'name', label: 'Team Name', type: 'text', required: true },
            { key: 'contractorVendorId', label: 'Labour Contractor (vendor)', type: 'vendorSelect' },
            { key: 'members', label: 'Members', type: 'stringArray', placeholder: 'Worker name' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'contractorVendorId', label: 'Contractor', vendorRef: true },
            { key: 'members', label: 'Members', joinArray: true },
        ],
    },
};

/* Settings & Lists tab — categorized simple lists (name + optional code/rate) */
export const FINANCE_SETTING_TYPES = [
    { key: 'work_type', label: 'Work Types', hasCode: false, hasRate: false },
    { key: 'expense_category', label: 'Expense Categories', hasCode: false, hasRate: false },
    { key: 'payment_mode', label: 'Payment Modes', hasCode: false, hasRate: false },
    { key: 'tds_section', label: 'TDS Sections', hasCode: true, hasRate: true },
];
