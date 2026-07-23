import React, { useState, useRef, useEffect } from 'react';
import moment from 'moment';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const buildGrid = (viewYear, viewMonth) => {
    const first = new Date(viewYear, viewMonth, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
};

// Custom calendar dropdown — native <input type="date"> popups are OS-rendered
// and can't be styled, so this reuses the app's dropdown chrome
// (.add-cat-dropdown / .add-cat-trigger) with a themed calendar grid instead.
const StyledDatePicker = ({ value, onChange, placeholder = 'dd/mm/yyyy', align = 'left' }) => {
    const [open, setOpen] = useState(false);
    const selected = value ? moment(value, 'YYYY-MM-DD') : null;
    const [viewYear, setViewYear] = useState((selected || moment()).year());
    const [viewMonth, setViewMonth] = useState((selected || moment()).month());
    const ref = useRef(null);
    const today = moment().format('YYYY-MM-DD');

    useEffect(() => {
        const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const openPicker = () => {
        const base = selected || moment();
        setViewYear(base.year());
        setViewMonth(base.month());
        setOpen(o => !o);
    };

    const shiftMonth = (delta) => {
        let m = viewMonth + delta, y = viewYear;
        if (m < 0) { m = 11; y -= 1; }
        if (m > 11) { m = 0; y += 1; }
        setViewMonth(m); setViewYear(y);
    };

    const pick = (day) => {
        const iso = moment({ year: viewYear, month: viewMonth, day }).format('YYYY-MM-DD');
        onChange(iso === value ? '' : iso);
        setOpen(false);
    };

    return (
        <div className="add-cat-dropdown" ref={ref}>
            <button type="button" className={`add-cat-trigger${open ? ' open' : ''}`} onClick={openPicker}>
                <span className={selected ? '' : 'trigger-placeholder'}>{selected ? selected.format('DD/MM/YYYY') : placeholder}</span>
                <i className="fa fa-calendar" />
            </button>

            {open && (
                <div className="date-picker-panel" style={align === 'right' ? { left: 'auto', right: 0 } : undefined}>
                    <div className="date-picker-nav">
                        <button type="button" onClick={() => shiftMonth(-1)}><i className="fa fa-chevron-left" /></button>
                        <span>{moment({ year: viewYear, month: viewMonth }).format('MMMM YYYY')}</span>
                        <button type="button" onClick={() => shiftMonth(1)}><i className="fa fa-chevron-right" /></button>
                    </div>
                    <div className="date-picker-weekdays">
                        {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
                    </div>
                    <div className="date-picker-days">
                        {buildGrid(viewYear, viewMonth).map((day, i) => {
                            if (!day) return <span key={i} />;
                            const iso = moment({ year: viewYear, month: viewMonth, day }).format('YYYY-MM-DD');
                            return (
                                <button
                                    type="button" key={i}
                                    className={`date-picker-day${value === iso ? ' active' : ''}${iso === today ? ' today' : ''}`}
                                    onClick={() => pick(day)}
                                >
                                    {day}
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

export default StyledDatePicker;
