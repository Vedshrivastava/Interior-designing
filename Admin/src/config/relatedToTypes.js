// UI-level "who" categories for an expense's optional "Related To" link —
// more granular than the schema's own relatedToType, since Contractor and
// Vendor/Supplier both save as the same financeVendor ref (distinguished
// only by vendorType, applied here via `filter`), matching how people
// actually think about "who this was for" on site rather than the
// underlying collection. Shared by ExpensesManager's Add form and
// ExpenseAnalysisView's filter row so the two never drift apart.
//
// Deliberately no "Company" entry — Payables' Company Expenses tab already
// covers that exact case (ExpensesManager's `fixedRelatedTo` prop, locked
// to the financeCompanySettings singleton with no picker step), so this
// list only offers the four that genuinely need a name picked from a list.
export const RELATED_TO_UI_OPTIONS = [
    { value: 'employee', label: 'Employee / Supervisor', backendType: 'financeEmployee', resourceKey: 'employees' },
    { value: 'contractor', label: 'Contractor', backendType: 'financeVendor', resourceKey: 'vendors', filter: v => v.vendorType === 'labour_contractor', presetValues: { vendorType: 'labour_contractor' } },
    { value: 'labourer', label: 'Labourer', backendType: 'financeLabourer', resourceKey: 'labourers' },
    { value: 'vendor', label: 'Vendor / Supplier', backendType: 'financeVendor', resourceKey: 'vendors', filter: v => v.vendorType !== 'labour_contractor' },
];

export const relatedToUiConfig = (uiType) => RELATED_TO_UI_OPTIONS.find(o => o.value === uiType);
