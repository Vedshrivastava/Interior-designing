import React from 'react';
import SettingSelectField from './SettingSelectField';
import QuickAddPicker from './QuickAddPicker';

/* Shared by MasterCrudTable and QuickAddPicker so the field-rendering logic
   for a FINANCE_MASTERS config only exists in one place. */
export const emptyFormFromFields = (fields) =>
    fields.reduce((acc, f) => {
        acc[f.key] = f.type === 'stringArray' ? [] : (f.default ?? '');
        return acc;
    }, {});

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
                <select value={value} onChange={e => setField(f.key, e.target.value)}>
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            );
        case 'vendorSelect':
            return <QuickAddPicker url={url} resourceKey="vendors" value={value} onChange={v => setField(f.key, v)} placeholder="— None —" />;
        case 'employeeSelect':
            return <QuickAddPicker url={url} resourceKey="employees" value={value} onChange={v => setField(f.key, v)} placeholder="— None —" />;
        case 'settingSelect':
            return (
                <>
                    <SettingSelectField
                        settingType={f.settingType}
                        options={settingOptions[f.settingType] || []}
                        value={value}
                        onChange={v => setField(f.key, v)}
                        placeholder={f.placeholder}
                    />
                    {f.note && <p style={{ fontSize: '0.78rem', color: 'var(--text-lt)', marginTop: '4px' }}>{f.note}</p>}
                </>
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
        default:
            return <input type={f.type} value={value} placeholder={f.placeholder} onChange={e => setField(f.key, e.target.value)} />;
    }
};
