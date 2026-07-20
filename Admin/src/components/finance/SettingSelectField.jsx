import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

/*
 * Dropdown-with-escape-hatch for a free-text field that's backed by a
 * financeSetting master list (Units, Cities) without actually constraining
 * the underlying field's type — financeMaterial.unit and
 * financeProject.siteLocation both stay plain Strings: pick a suggestion,
 * or type anything new (existing records with values not in the master
 * list keep displaying/editing fine, since this never validates against
 * `options`).
 *
 * A real, visible suggestion panel (same .add-cat-list/.add-cat-option
 * look StyledSelect/SettingPicker already use), not a native
 * `<input list>` datalist — that had the field's own escape-hatch
 * philosophy right (typing something brand new is the common case here,
 * unlike Payment Mode's small fixed set) but a datalist's near-invisible,
 * browser-inconsistent affordance made the existing options easy to miss
 * entirely, encouraging avoidable near-duplicates (e.g. "bag" vs "bags")
 * purely from not seeing what already exists.
 *
 * Purely presentational — fetching `options` and auto-registering a newly
 * typed value back into the settingType master both happen in the parent
 * (MasterCrudTable's `settingSelect` field type, or NewProjectWizard's own
 * city field) so this can be reused without duplicating fetch logic.
 */
const SettingSelectField = ({ settingType, options, value, onChange, placeholder }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const query = (value || '').toLowerCase();
    const visible = query ? options.filter(o => o.name.toLowerCase().includes(query)) : options;

    return (
        <div className="add-cat-dropdown" ref={ref}>
            <input
                type="text"
                className={`add-cat-trigger${open ? ' open' : ''}`}
                style={{ cursor: 'text', textAlign: 'left' }}
                value={value}
                placeholder={placeholder}
                onFocus={() => setOpen(true)}
                onChange={e => onChange(e.target.value)}
            />
            {open && options.length > 0 && (
                <ul className="add-cat-list">
                    {visible.length === 0 ? (
                        <li className="add-cat-option" style={{ cursor: 'default', color: 'var(--text-lt)' }}>No matches — keep typing to use a new value</li>
                    ) : visible.map(o => (
                        <li
                            key={o._id}
                            className={`add-cat-option${o.name === value ? ' active' : ''}`}
                            onMouseDown={e => { e.preventDefault(); onChange(o.name); setOpen(false); }}
                        >
                            {o.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
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
