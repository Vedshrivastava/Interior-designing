import React, { useState, useRef, useEffect } from 'react';
import moment from 'moment';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Same dropdown chrome as StyledDatePicker (native <input type="month">
// popups are just as OS-rendered/unstylable as type="date") — a year nav
// plus a 12-month grid instead of a day grid.
const StyledMonthPicker = ({ value, onChange, placeholder = 'mm/yyyy', align = 'left' }) => {
    const [open, setOpen] = useState(false);
    const selected = value ? moment(value, 'YYYY-MM') : null;
    const [viewYear, setViewYear] = useState((selected || moment()).year());
    const ref = useRef(null);

    useEffect(() => {
        const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const openPicker = () => {
        setViewYear((selected || moment()).year());
        setOpen(o => !o);
    };

    const pick = (monthIndex) => {
        const iso = moment({ year: viewYear, month: monthIndex }).format('YYYY-MM');
        onChange(iso === value ? '' : iso);
        setOpen(false);
    };

    return (
        <div className="add-cat-dropdown" ref={ref}>
            <button type="button" className={`add-cat-trigger${open ? ' open' : ''}`} onClick={openPicker}>
                <span>{selected ? selected.format('MMMM YYYY') : placeholder}</span>
                <i className="fa fa-calendar" />
            </button>

            {open && (
                <div className="date-picker-panel" style={align === 'right' ? { left: 'auto', right: 0 } : undefined}>
                    <div className="date-picker-nav">
                        <button type="button" onClick={() => setViewYear(y => y - 1)}><i className="fa fa-chevron-left" /></button>
                        <span>{viewYear}</span>
                        <button type="button" onClick={() => setViewYear(y => y + 1)}><i className="fa fa-chevron-right" /></button>
                    </div>
                    <div className="month-picker-grid">
                        {MONTHS.map((m, i) => {
                            const iso = moment({ year: viewYear, month: i }).format('YYYY-MM');
                            return (
                                <button
                                    type="button" key={m}
                                    className={`month-picker-cell${value === iso ? ' active' : ''}`}
                                    onClick={() => pick(i)}
                                >
                                    {m}
                                </button>
                            );
                        })}
                    </div>
                    {value && (
                        <button type="button" className="date-picker-clear" onClick={() => { onChange(''); setOpen(false); }}>
                            Clear
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default StyledMonthPicker;
