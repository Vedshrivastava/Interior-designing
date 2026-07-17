// UI-level "who" categories for an expense's optional "Related To" link —
// more granular than the schema's own relatedToType, since Contractor and
// Vendor/Supplier both save as the same financeVendor ref (distinguished
// only by vendorType, applied here via `filter`), matching how people
// actually think about "who this was for" on site rather than the
// underlying collection. Shared by ExpensesManager's Add form and
// ExpenseAnalysisView's filter row so the two never drift apart.
export const RELATED_TO_UI_OPTIONS = [
    { value: 'employee', label: 'Employee / Supervisor', backendType: 'financeEmployee', resourceKey: 'employees' },
    { value: 'contractor', label: 'Contractor', backendType: 'financeVendor', resourceKey: 'vendors', filter: v => v.vendorType === 'labour_contractor', presetValues: { vendorType: 'labour_contractor' } },
    { value: 'labourer', label: 'Labourer', backendType: 'financeLabourer', resourceKey: 'labourers' },
    { value: 'vendor', label: 'Vendor / Supplier', backendType: 'financeVendor', resourceKey: 'vendors', filter: v => v.vendorType !== 'labour_contractor' },
    // Singleton — there's only one financeCompanySettings document, so this
    // resolves straight to it with no name-picker step, unlike the other
    // four which each list real records to choose from.
    { value: 'company', label: 'Company (this business)', backendType: 'financeCompanySettings', singleton: true },
];

export const relatedToUiConfig = (uiType) => RELATED_TO_UI_OPTIONS.find(o => o.value === uiType);
