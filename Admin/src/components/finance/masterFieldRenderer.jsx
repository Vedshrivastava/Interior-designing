import React from 'react';
import SettingSelectField from './SettingSelectField';
import QuickAddPicker from './QuickAddPicker';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';

/* Shared by MasterCrudTable and QuickAddPicker so the field-rendering logic
   for a FINANCE_MASTERS config only exists in one place. */

// A field's optional `note` — was only ever shown for settingSelect fields;
// pulled out here so any field type can carry one (e.g. a number field
// explaining what a rate actually gets used for).
export const FieldNote = ({ note }) =>
    note ? <p style={{ fontSize: '0.78rem', color: 'var(--text-lt)', marginTop: '4px' }}>{note}</p> : null;

export const emptyFormFromFields = (fields) =>
    fields.reduce((acc, f) => {
        acc[f.key] = (f.type === 'stringArray' || f.type === 'workTypeMultiSelect') ? [] : (f.default ?? '');
        return acc;
    }, {});

// Groups already-visible fields into consecutive runs sharing the same
// `section` label (e.g. "Contact" / "Bank Details" / "Other"), each its
// own wizard-field-grid under a wizard-section-label divider — same visual
// grouping the Settings redesign uses. Fields with no `section` tag (older
// or short resource configs like Materials/Bank Accounts, where a single
// short list needs no grouping) fall into one unlabeled group.
export const groupFieldsBySection = (fields) => {
    const groups = [];
    for (const f of fields) {
        const section = f.section || null;
        const last = groups[groups.length - 1];
        if (last && last.section === section) last.fields.push(f);
        else groups.push({ section, fields: [f] });
    }
    return groups;
};

// `vendorSelect` renders as a nested QuickAddPicker (not a plain select) so
// a Team can be created without a side trip to add its contractor Vendor
// first — same behavior whether the Team form is opened from Masters
// directly or from a Team quick-add elsewhere.
export const renderMasterField = (f, form, setField, { url, settingOptions = {} } = {}) => {
    const value = form[f.key];
    switch (f.type) {
        case 'textarea':
            return <textarea rows="3" value={value} onChange={e => setField(f.key, e.target.value)} placeholder={f.placeholder} />;
        case 'select':
            return (
                <StyledSelect
                    value={value} onChange={v => setField(f.key, v)}
                    placeholder={f.placeholder || `Select ${f.label.toLowerCase()}…`}
                    options={f.options}
                />
            );
        case 'vendorSelect': {
            // Defaults to labour_contractor (Team's own contractor picker,
            // the original and still most common use) — pass
            // f.vendorType to scope to a different type instead, e.g.
            // 'labour_provider' for a Labourer's optional provider.
            const vt = f.vendorType || 'labour_contractor';
            return (
                <QuickAddPicker
                    url={url} resourceKey="vendors" value={value} onChange={v => setField(f.key, v)}
                    filter={v => v.vendorType === vt} presetValues={{ vendorType: vt }}
                    placeholder="None"
                />
            );
        }
        // A plain resource-scoped picker — same nested-QuickAddPicker
        // shape as vendorSelect, but for any FINANCE_MASTERS resource that
        // isn't a vendor at all (e.g. 'labourProviders', 'referrals').
        // Pass f.resourceKey to say which one.
        case 'resourceSelect':
            return (
                <QuickAddPicker
                    url={url} resourceKey={f.resourceKey} value={value} onChange={v => setField(f.key, v)}
                    placeholder="None"
                />
            );
        case 'employeeSelect':
            return <QuickAddPicker url={url} resourceKey="employees" value={value} onChange={v => setField(f.key, v)} placeholder="None" />;
        case 'settingSelect':
            return (
                <SettingSelectField
                    settingType={f.settingType}
                    options={settingOptions[f.settingType] || []}
                    value={value}
                    onChange={v => setField(f.key, v)}
                    placeholder={f.placeholder}
                />
            );
        case 'workTypeMultiSelect': {
            const options = settingOptions[f.settingType] || [];
            const selected = value || [];
            const toggle = (name) => setField(f.key, selected.includes(name) ? selected.filter(n => n !== name) : [...selected, name]);
            return (
                <div className="labour-select-box">
                    <div className="labour-select-list">
                        {options.length === 0 ? (
                            <p className="labour-select-empty">No work types set up yet; add one from Masters → Work Types.</p>
                        ) : options.map(o => {
                            const active = selected.includes(o.name);
                            return (
                                <button
                                    type="button" key={o._id}
                                    className={`labour-chip${active ? ' active' : ''}`}
                                    onClick={() => toggle(o.name)}
                                    aria-pressed={active}
                                >
                                    <span className="labour-chip-mark">
                                        <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M1 5L4.5 8.5L11 1.5" stroke="var(--gold-lt)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                    {o.name}
                                </button>
                            );
                        })}
                    </div>
                    <div className="labour-select-footer">
                        <span className="labour-select-count">{selected.length === 0 ? 'All work types' : `${selected.length} selected`}</span>
                    </div>
                </div>
            );
        }
        case 'confirmText':
            // Deliberately never pre-filled from an existing record (see
            // MasterCrudTable's openEdit / QuickAddPicker — neither ever
            // stores this key server-side, so it's always blank on open,
            // even in Edit mode) — forces a fresh re-type every time
            // rather than trivially matching a value that was itself
            // copy-pasted in wrong. Paste is blocked for the same reason.
            return (
                <input
                    type="text" value={value} placeholder={f.placeholder}
                    onChange={e => setField(f.key, e.target.value)}
                    onPaste={e => e.preventDefault()}
                />
            );
        case 'stringArray':
            return (
                <div className="add-product-points">
                    {(value || []).map((v, idx) => (
                        <div key={idx} className="point-input">
                            <input type="text" value={v} placeholder={f.placeholder}
                                onChange={e => setField(f.key, value.map((vv, i) => (i === idx ? e.target.value : vv)))} />
                            <button type="button" className="remove-point-btn" onClick={() => setField(f.key, value.filter((_, i) => i !== idx))}>X</button>
                        </div>
                    ))}
                    <button type="button" className="add-point-btn" onClick={() => setField(f.key, [...(value || []), ''])}>+ Add {f.label.replace(/s$/, '')}</button>
                </div>
            );
        case 'date':
            return <StyledDatePicker value={value} onChange={v => setField(f.key, v)} />;
        case 'number':
            // A scrolled mouse wheel over a focused number input silently
            // steps its value (and can drive it negative) in Chrome —
            // blur on wheel so scrolling the page never mutates a rate/
            // amount/quantity field you're not actively typing into.
            return <input type="number" min="0" value={value} placeholder={f.placeholder} onChange={e => setField(f.key, e.target.value)} onWheel={e => e.target.blur()} />;
        default:
            return <input type={f.type} value={value} placeholder={f.placeholder} onChange={e => setField(f.key, e.target.value)} />;
    }
};
