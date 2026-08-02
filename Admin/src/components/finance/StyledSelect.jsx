import React, { useState, useRef, useEffect } from 'react';

// Single-select dropdown matching AddDesign.jsx's category picker
// (.add-cat-dropdown / .add-cat-trigger / .add-cat-list / .add-cat-option).
// Re-clicking the already-selected option clears it back to the placeholder
// — the one reset affordance every consumer gets for free, app-wide,
// without each caller having to remember to seed an empty option itself.
//
// `loading` (optional): while the options list is still being fetched, the
// trigger shows a shimmer bar instead of the placeholder — same "this piece
// specifically is still loading" idea as KpiCard's own `loading` prop
// (dashboard.css's .kpi-skeleton-bar), so an empty-looking picker doesn't
// read as "there's nothing to select" while its data is still in flight.
// Not openable while loading, same as `disabled`.
const StyledSelect = ({ value, onChange, options, placeholder = 'Select…', disabled = false, loading = false }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const selected = options.find(o => o.value === value);
    const inert = disabled || loading;

    return (
        <div className="add-cat-dropdown" ref={ref}>
            <button
                type="button"
                className={`add-cat-trigger${open ? ' open' : ''}${disabled ? ' disabled' : ''}${loading ? ' loading' : ''}`}
                onClick={() => !inert && setOpen(o => !o)}
                disabled={inert}
            >
                {loading ? <span className="select-skeleton-bar" /> : (
                    <span className={selected ? '' : 'trigger-placeholder'}>{selected ? selected.label : placeholder}</span>
                )}
                {!loading && <i className="fa fa-chevron-down" />}
            </button>

            {open && !inert && (
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
