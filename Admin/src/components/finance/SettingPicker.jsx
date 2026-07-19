import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';

/*
 * A real, visible dropdown for a small settingType-backed list (Payment
 * Modes, Commission Types, …) — with a "+ Add New" escape hatch for a
 * value that isn't in the list yet. SettingSelectField (a plain
 * `<input list=…>` datalist) covers this same data shape elsewhere
 * (Site Location, Unit, …), which is the right call for fields where
 * typing something brand new is the common case; Payment Mode is the
 * opposite — a small, mostly-fixed set (Cash, Bank Transfer, Cheque, UPI…)
 * where a native datalist's near-invisible affordance (no visible
 * options/chevron until you start typing, easy to mistake for "empty")
 * was the actual complaint, not a data problem. Manage the shared list
 * itself from Masters → Payment Modes; this just picks from it.
 */
const SettingPicker = ({ url, settingType, options, onAdded, value, onChange, placeholder, disabled }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);

    const submitNew = async () => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/settings/add`, { settingType, name: trimmed }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Added');
                onChange(trimmed);
                await onAdded?.();
                setNewName('');
                setAdding(false);
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding');
        } finally { setSaving(false); }
    };

    return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
                <StyledSelect
                    value={value} onChange={onChange} disabled={disabled}
                    placeholder={placeholder || 'Select…'}
                    options={options.map(o => ({ value: o, label: o }))}
                />
            </div>
            {adding ? (
                <>
                    <input
                        type="text" value={newName} onChange={e => setNewName(e.target.value)}
                        placeholder="New value" style={{ maxWidth: '150px' }} autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitNew(); } }}
                    />
                    <button type="button" className="add-point-btn" style={{ whiteSpace: 'nowrap' }} disabled={saving} onClick={submitNew}>
                        {saving ? 'Adding…' : 'Add'}
                    </button>
                </>
            ) : (
                <button type="button" className="add-point-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setAdding(true)} disabled={disabled}>
                    + Add New
                </button>
            )}
        </div>
    );
};

export default SettingPicker;
