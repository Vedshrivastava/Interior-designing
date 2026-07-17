import React from 'react';

// A proper sliding switch for a single boolean setting — more visible and
// more recognizable as "on/off" than a bare native checkbox, especially
// tucked into a busy row like the Work Detail day-report header.
const ToggleSwitch = ({ checked, onChange, label }) => (
    <label className="toggle-switch">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="toggle-switch-track"><span className="toggle-switch-thumb" /></span>
        {label && <span className="toggle-switch-label">{label}</span>}
    </label>
);

export default ToggleSwitch;
