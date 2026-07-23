import React, { useState, useRef, useEffect } from 'react';

// Single-select dropdown matching AddDesign.jsx's category picker
// (.add-cat-dropdown / .add-cat-trigger / .add-cat-list / .add-cat-option).
// Re-clicking the already-selected option clears it back to the placeholder
// — the one reset affordance every consumer gets for free, app-wide,
// without each caller having to remember to seed an empty option itself.
const StyledSelect = ({ value, onChange, options, placeholder = 'Select…', disabled = false }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const selected = options.find(o => o.value === value);

    return (
        <div className="add-cat-dropdown" ref={ref}>
            <button
                type="button"
                className={`add-cat-trigger${open ? ' open' : ''}${disabled ? ' disabled' : ''}`}
                onClick={() => !disabled && setOpen(o => !o)}
                disabled={disabled}
            >
                <span className={selected ? '' : 'trigger-placeholder'}>{selected ? selected.label : placeholder}</span>
                <i className="fa fa-chevron-down" />
            </button>

            {open && !disabled && (
                <ul className="add-cat-list">
                    {options.map(opt => (
                        <li
                            key={opt.value}
                            className={`add-cat-option${value === opt.value ? ' active' : ''}`}
                            onClick={() => { onChange(value === opt.value ? '' : opt.value); setOpen(false); }}
                        >
                            <span>{opt.label}</span>
                            {value === opt.value && <i className="fa fa-check" />}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default StyledSelect;
