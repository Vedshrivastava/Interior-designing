import React, { useState, useRef, useEffect } from 'react';
import moment from 'moment';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// The actual clipping boundary for a non-portaled absolute-positioned
// panel is the nearest scrollable ancestor's box, not the viewport — a
// modal body with overflow-y:auto clips well before the viewport edge
// does. Walks up from the trigger to find it, falling back to the
// viewport (documentElement) when nothing closer scrolls.
const findScrollAncestor = (el) => {
    let node = el?.parentElement;
    while (node && node !== document.body) {
        const style = getComputedStyle(node);
        if (/(auto|scroll|hidden)/.test(style.overflowY)) return node;
        node = node.parentElement;
    }
    return document.documentElement;
};

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
    // The panel isn't portaled — inside a scrollable modal body (Work
    // Review's tallest state, e.g.) the trigger can sit close enough to
    // the bottom of the visible area that a ~340px panel opening
    // downward has nowhere to render and gets clipped by the modal's own
    // overflow before it ever gets a chance to scroll into view. Flipping
    // to open upward when there isn't room below is the same thing every
    // real date picker does; checked against the viewport (not the exact
    // scroll ancestor) is a cheap, good-enough heuristic since a clipped
    // ancestor's own boundary is never further from the trigger than the
    // viewport edge is.
    const [openUpward, setOpenUpward] = useState(false);
    const [panelMaxHeight, setPanelMaxHeight] = useState(null);
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
        setOpen(o => {
            const next = !o;
            if (next && ref.current) {
                const triggerRect = ref.current.getBoundingClientRect();
                const panelHeight = value ? 386 : 340; // roughly nav+weekdays+6 day rows(+Clear)
                const margin = 10;
                const ancestor = findScrollAncestor(ref.current);
                const bounds = ancestor === document.documentElement
                    ? { top: 0, bottom: window.innerHeight }
                    : ancestor.getBoundingClientRect();
                const spaceBelow = bounds.bottom - triggerRect.bottom - margin;
                const spaceAbove = triggerRect.top - bounds.top - margin;
                const goUp = spaceBelow < panelHeight && spaceAbove > spaceBelow;
                setOpenUpward(goUp);
                const available = goUp ? spaceAbove : spaceBelow;
                setPanelMaxHeight(available < panelHeight ? Math.max(available, 160) : null);
            }
            return next;
        });
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
                <div
                    className={`date-picker-panel${openUpward ? ' date-picker-panel-up' : ''}`}
                    style={{
                        ...(align === 'right' ? { left: 'auto', right: 0 } : null),
                        ...(panelMaxHeight ? { maxHeight: panelMaxHeight, overflowY: 'auto' } : null),
                    }}
                >
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
