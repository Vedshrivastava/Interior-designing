import React from 'react';
import axios from 'axios';

/*
 * Dropdown-with-escape-hatch for a free-text field that's backed by a
 * financeSetting master list (Units, Cities, Commission Types) without
 * actually constraining the underlying field's type — financeMaterial.unit
 * and financeProject.siteLocation both stay plain Strings. A text input
 * with a <datalist> of existing values: pick a suggestion, or type
 * anything new (existing records with values not in the master list keep
 * displaying/editing fine, since this never validates against `options`).
 *
 * Purely presentational — fetching `options` and auto-registering a newly
 * typed value back into the settingType master both happen in the parent
 * (MasterCrudTable's `settingSelect` field type, or NewProjectWizard's own
 * city field) so this can be reused without duplicating fetch logic.
 */
const SettingSelectField = ({ settingType, options, value, onChange, placeholder }) => {
    const listId = `setting-${settingType}-options`;
    return (
        <>
            <input type="text" list={listId} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
            <datalist id={listId}>
                {options.map(o => <option key={o._id} value={o.name} />)}
            </datalist>
        </>
    );
};

// Best-effort: silently registers a newly typed value into the settingType
// master so it shows up as a suggestion next time. Never blocks or fails
// the save it's called from — the underlying field is a plain String
// regardless of whether this succeeds.
export const registerSettingIfNew = async (url, authHeader, settingType, value, existingOptions) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return;
    const alreadyExists = existingOptions.some(o => o.name.toLowerCase() === trimmed.toLowerCase());
    if (alreadyExists) return;
    try {
        await axios.post(`${url}/api/finance/settings/add`, { settingType, name: trimmed }, authHeader);
    } catch {
        // non-blocking — see comment above
    }
};

export default SettingSelectField;
