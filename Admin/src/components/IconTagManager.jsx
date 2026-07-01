import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

// Iconify helpers
export const iconifyImgUrl = (iconId) => {
  if (!iconId || !iconId.includes(':')) return null;
  const [prefix, name] = iconId.split(':');
  return `https://api.iconify.design/${prefix}/${name}.svg`;
};

export const COLOR_OPTIONS = [
    '#3b82f6', '#f59e0b', '#ef4444', '#6366f1', '#22c55e',
    '#8b5cf6', '#14b8a6', '#ec4899', '#f97316', '#64748b',
    '#a78bfa', '#c9a87c', '#10b981', '#78716c', '#0ea5e9',
    '#dc2626', '#16a34a', '#9333ea', '#0891b2', '#d97706',
];

/* ── Reusable manager hook for DB-driven icon+colour tag lists (specialities, applications, categories, subcategories) ──
   getExtraPayload: optional fn returning extra fields merged into the POST body on save (e.g. parent categories for subcategories) */
export function useIconTagManager(url, token, apiBase, fallbackNames, getExtraPayload) {
    const [objects,     setObjects]     = useState([]);
    const [adding,      setAdding]      = useState(false);
    const [newName,     setNewName]     = useState('');
    const [newIcon,     setNewIcon]     = useState('');
    const [newColor,    setNewColor]    = useState('#c9a87c');
    const [iconSearch,  setIconSearch]  = useState('');
    const [iconResults, setIconResults] = useState([]);
    const [iconLoading, setIconLoading] = useState(false);
    const [saving,      setSaving]      = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting,    setDeleting]    = useState(false);
    const debounceRef = useRef(null);

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}${apiBase}/list`);
            if (res.data.success) setObjects(res.data.data);
        } catch {
            setObjects(fallbackNames.map((n, i) => ({ _id: n, name: n, icon: 'check', color: '#c9a87c', order: i })));
        }
    };
    useEffect(() => { fetchList(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            if (!iconSearch.trim()) { setIconResults([]); return; }
            setIconLoading(true);
            try {
                const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(iconSearch)}&limit=60`);
                const d = await res.json();
                setIconResults(d.icons || []);
            } catch { setIconResults([]); }
            finally { setIconLoading(false); }
        }, 350);
        return () => clearTimeout(debounceRef.current);
    }, [iconSearch]);

    useEffect(() => {
        if (adding && newName.trim()) setIconSearch(newName.trim().split(/\s+/)[0]);
    }, [newName, adding]);

    const openAdd  = () => { setAdding(true); setNewName(''); setNewIcon(''); setNewColor('#c9a87c'); setIconSearch(''); setIconResults([]); };
    const closeAdd = () => { setAdding(false); setNewName(''); setNewIcon(''); setNewColor('#c9a87c'); setIconSearch(''); setIconResults([]); };

    const save = async () => {
        if (!newName.trim()) { toast.error('Name is required'); return; }
        setSaving(true);
        try {
            const extra = getExtraPayload ? getExtraPayload() : {};
            const res = await axios.post(`${url}${apiBase}/add`,
                { name: newName.trim(), icon: newIcon, color: newColor, ...extra },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) { toast.success(res.data.message); closeAdd(); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Failed to add'); }
        finally { setSaving(false); }
    };

    const confirmDelete = async (onRemoved) => {
        if (!confirmItem || deleting) return;
        setDeleting(true);
        try {
            const res = await axios.post(`${url}${apiBase}/remove`,
                { _id: confirmItem._id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success(res.data.message);
                onRemoved?.(confirmItem.name);
                setConfirmItem(null);
                await fetchList();
            } else { toast.error(res.data.message); }
        } catch { toast.error('Failed to remove'); }
        finally { setDeleting(false); }
    };

    return {
        objects, adding, openAdd, closeAdd,
        newName, setNewName, newIcon, setNewIcon, newColor, setNewColor,
        iconSearch, setIconSearch, iconResults, iconLoading,
        saving, save, confirmItem, setConfirmItem, deleting, confirmDelete,
    };
}

/* ── Reusable section: chip grid + inline "add new" form with Iconify search ──
   fixedColor: when set, every badge (preset or new) uses this single colour
   and the colour picker is hidden — used for Applications (golden theme). */
export function IconTagSection({ label, hint, placeholder, manager, selected, onToggle, fixedColor, singular }) {
    return (
        <div className="add-multi-section flex-col">
            <h2>{label} {hint && <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#888' }}>{hint}</span>}</h2>
            <div className="add-multi-grid">
                {manager.objects.map(item => {
                    const sel = selected.includes(item.name);
                    const color = fixedColor || item.color;
                    const iconUrl = iconifyImgUrl(item.icon);
                    return (
                        <div key={item._id} className="spec-chip-wrap">
                            <button type="button"
                                className={`add-multi-chip spec-chip${sel ? ' active' : ''}`}
                                style={sel ? { background: `${color}22`, borderColor: `${color}88`, color } : {}}
                                onClick={() => onToggle(item.name)}>
                                {iconUrl && <img src={sel ? `${iconUrl}?color=${encodeURIComponent(color)}` : iconUrl} width={13} height={13} alt="" style={{ flexShrink: 0 }} />}
                                {item.name}
                            </button>
                            <button type="button" className="spec-trash-btn"
                                title={`Remove "${item.name}"`}
                                onClick={() => manager.setConfirmItem(item)}>
                                <i className="fa-solid fa-trash" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {!manager.adding ? (
                <button type="button" className="add-point-btn" style={{ marginTop: '10px' }} onClick={manager.openAdd}>
                    <i className="fa fa-plus" /> Add new {singular || label.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '')}
                </button>
            ) : (
                <div className="spec-add-form">
                    <input
                        type="text" placeholder={placeholder}
                        value={manager.newName} onChange={e => manager.setNewName(e.target.value)}
                        autoFocus
                    />
                    <p className="spec-form-label">Pick an icon</p>

                    <div className="spec-icon-search-wrap">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            type="text"
                            placeholder="Search 200,000+ icons…"
                            value={manager.iconSearch}
                            onChange={e => manager.setIconSearch(e.target.value)}
                        />
                        {manager.iconLoading && <i className="fa-solid fa-circle-notch fa-spin" style={{ color: 'var(--text-lt)', fontSize: '0.75rem', flexShrink: 0 }} />}
                        {manager.iconSearch && !manager.iconLoading && <button type="button" className="spec-icon-search-clear" onClick={() => manager.setIconSearch('')}>×</button>}
                    </div>

                    <div className="spec-icon-grid-wrap">
                        {manager.iconResults.length === 0 && !manager.iconLoading && manager.iconSearch && (
                            <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-lt)', textAlign: 'center', padding: '16px 0', margin: 0 }}>No icons found — try a different word</p>
                        )}
                        {manager.iconResults.length === 0 && !manager.iconLoading && !manager.iconSearch && (
                            <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-lt)', textAlign: 'center', padding: '16px 0', margin: 0 }}>
                                <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '6px', color: 'var(--gold)' }} />
                                Type the name above — icons will auto-appear
                            </p>
                        )}
                        {manager.iconResults.length > 0 && (
                            <div className="spec-icon-grid spec-icon-grid--full">
                                {manager.iconResults.map(iconId => {
                                    const url = iconifyImgUrl(iconId);
                                    const shortName = iconId.split(':')[1] || iconId;
                                    return (
                                        <button key={iconId} type="button"
                                            className={`spec-icon-btn${manager.newIcon === iconId ? ' active' : ''}`}
                                            title={iconId}
                                            onClick={() => manager.setNewIcon(iconId)}>
                                            <img src={manager.newIcon === iconId ? `${url}?color=%23fff` : url} width={20} height={20} alt={shortName} />
                                            <span>{shortName.slice(0, 8)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {!fixedColor && (
                        <>
                            <p className="spec-form-label">Pick a colour</p>
                            <div className="spec-color-row">
                                {COLOR_OPTIONS.map(c => (
                                    <button key={c} type="button"
                                        className={`spec-color-swatch${manager.newColor === c ? ' active' : ''}`}
                                        style={{ background: c }}
                                        onClick={() => manager.setNewColor(c)} />
                                ))}
                            </div>
                        </>
                    )}

                    <div className="spec-preview">
                        Preview:{' '}
                        {(() => { const pc = fixedColor || manager.newColor; return (
                        <span className="spec-preview-badge" style={{ background: `${pc}22`, borderColor: `${pc}88`, color: pc }}>
                            {manager.newIcon && iconifyImgUrl(manager.newIcon) && (
                                <img src={`${iconifyImgUrl(manager.newIcon)}?color=${encodeURIComponent(pc)}`} width={13} height={13} alt="" />
                            )}
                            {manager.newName || 'Name'}
                        </span>
                        ); })()}
                        {!manager.newIcon && <span style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.72rem', color: 'var(--text-lt)', marginLeft: '8px' }}>← pick an icon above</span>}
                    </div>

                    <div className="add-cat-new-actions" style={{ marginTop: '10px' }}>
                        <button type="button" className="add-cat-save-btn" onClick={manager.save} disabled={manager.saving}>{manager.saving ? 'Saving…' : 'Save'}</button>
                        <button type="button" className="add-cat-cancel-btn" onClick={manager.closeAdd}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Subcategory dropdown: multi-select, icon-aware, with inline
   "add new" form that includes a parent-category multi-select checklist ──
   catManager only needs a `.objects` array of { _id, name } for the parent-category checklist. */
export function SubcategorySection({ subManager, catManager, values, onToggle, availableForCategories, dropdownOpen, setDropdownOpen, dropRef, newParentCats, setNewParentCats }) {
    const visibleSubs = subManager.objects.filter(s => s.categories?.some(c => availableForCategories.includes(c)));

    return (
        <div className="add-cat-dropdown-wrap flex-col">
            <h2>Subcategories <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#888' }}>(select all that apply)</span></h2>
            <div className="add-cat-dropdown" ref={dropRef}>
                <button type="button" className={`add-cat-trigger${dropdownOpen ? ' open' : ''}`} onClick={() => setDropdownOpen(o => !o)}>
                    <span>{values.length > 0 ? values.join(', ') : 'Select subcategories'}</span>
                    <i className="fa fa-chevron-down" />
                </button>
                {dropdownOpen && (
                    <ul className="add-cat-list">
                        {visibleSubs.map(sub => {
                            const iconUrl = iconifyImgUrl(sub.icon);
                            const sel = values.includes(sub.name);
                            return (
                                <li key={sub._id} className={`add-cat-option${sel ? ' active' : ''}`}
                                    onClick={() => onToggle(sub.name)}>
                                    {iconUrl && <img src={iconUrl} width={13} height={13} alt="" style={{ marginRight: '6px', flexShrink: 0 }} />}
                                    <span>{sub.name}</span>
                                    <div className="add-cat-option-actions" onClick={e => e.stopPropagation()}>
                                        {sel && <i className="fa fa-check" />}
                                        <i className="fa fa-trash add-cat-trash" title={`Remove "${sub.name}"`} onClick={e => { e.stopPropagation(); subManager.setConfirmItem(sub); }} />
                                    </div>
                                </li>
                            );
                        })}

                        {!subManager.adding ? (
                            <li className="add-cat-option add-cat-new-btn" onClick={e => { e.stopPropagation(); setNewParentCats([]); subManager.openAdd(); }}>
                                <i className="fa fa-plus" /><span>Add new subcategory</span>
                            </li>
                        ) : (
                            <li className="add-cat-new-form" onClick={e => e.stopPropagation()}>
                                <input
                                    type="text" placeholder="Subcategory name e.g. Skylights"
                                    value={subManager.newName} onChange={e => subManager.setNewName(e.target.value)}
                                    autoFocus
                                />
                                <p className="spec-form-label">Belongs to category</p>
                                <div className="sub-parent-cat-list">
                                    {catManager.objects.map(cat => {
                                        const checked = newParentCats.includes(cat.name);
                                        return (
                                            <label key={cat._id} className={`sub-parent-cat-item${checked ? ' active' : ''}`}>
                                                <input type="checkbox" checked={checked}
                                                    onChange={() => setNewParentCats(prev => checked ? prev.filter(c => c !== cat.name) : [...prev, cat.name])} />
                                                {cat.name}
                                            </label>
                                        );
                                    })}
                                </div>

                                <p className="spec-form-label">Pick an icon</p>
                                <div className="spec-icon-search-wrap">
                                    <i className="fa-solid fa-magnifying-glass" />
                                    <input
                                        type="text" placeholder="Search 200,000+ icons…"
                                        value={subManager.iconSearch} onChange={e => subManager.setIconSearch(e.target.value)}
                                    />
                                    {subManager.iconLoading && <i className="fa-solid fa-circle-notch fa-spin" style={{ color: 'var(--text-lt)', fontSize: '0.75rem', flexShrink: 0 }} />}
                                    {subManager.iconSearch && !subManager.iconLoading && <button type="button" className="spec-icon-search-clear" onClick={() => subManager.setIconSearch('')}>×</button>}
                                </div>
                                <div className="spec-icon-grid-wrap">
                                    {subManager.iconResults.length === 0 && !subManager.iconLoading && subManager.iconSearch && (
                                        <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-lt)', textAlign: 'center', padding: '16px 0', margin: 0 }}>No icons found — try a different word</p>
                                    )}
                                    {subManager.iconResults.length === 0 && !subManager.iconLoading && !subManager.iconSearch && (
                                        <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-lt)', textAlign: 'center', padding: '16px 0', margin: 0 }}>
                                            <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '6px', color: 'var(--gold)' }} />
                                            Type the name above — icons will auto-appear
                                        </p>
                                    )}
                                    {subManager.iconResults.length > 0 && (
                                        <div className="spec-icon-grid spec-icon-grid--full">
                                            {subManager.iconResults.map(iconId => {
                                                const url = iconifyImgUrl(iconId);
                                                const shortName = iconId.split(':')[1] || iconId;
                                                return (
                                                    <button key={iconId} type="button"
                                                        className={`spec-icon-btn${subManager.newIcon === iconId ? ' active' : ''}`}
                                                        title={iconId}
                                                        onClick={() => subManager.setNewIcon(iconId)}>
                                                        <img src={subManager.newIcon === iconId ? `${url}?color=%23fff` : url} width={20} height={20} alt={shortName} />
                                                        <span>{shortName.slice(0, 8)}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <p className="spec-form-label">Pick a colour</p>
                                <div className="spec-color-row">
                                    {COLOR_OPTIONS.map(c => (
                                        <button key={c} type="button"
                                            className={`spec-color-swatch${subManager.newColor === c ? ' active' : ''}`}
                                            style={{ background: c }}
                                            onClick={() => subManager.setNewColor(c)} />
                                    ))}
                                </div>

                                <div className="spec-preview">
                                    Preview:{' '}
                                    <span className="spec-preview-badge" style={{ background: `${subManager.newColor}22`, borderColor: `${subManager.newColor}88`, color: subManager.newColor }}>
                                        {subManager.newIcon && iconifyImgUrl(subManager.newIcon) && (
                                            <img src={`${iconifyImgUrl(subManager.newIcon)}?color=${encodeURIComponent(subManager.newColor)}`} width={13} height={13} alt="" />
                                        )}
                                        {subManager.newName || 'Name'}
                                    </span>
                                </div>

                                <div className="add-cat-new-actions" style={{ marginTop: '10px' }}>
                                    <button type="button" className="add-cat-save-btn" onClick={subManager.save} disabled={subManager.saving}>{subManager.saving ? 'Saving…' : 'Save'}</button>
                                    <button type="button" className="add-cat-cancel-btn" onClick={subManager.closeAdd}>Cancel</button>
                                </div>
                            </li>
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}

/* ── Shared confirm-delete modal ── */
export function ConfirmTagDeleteModal({ manager, typeLabel, onRemoved }) {
    if (!manager.confirmItem) return null;
    return ReactDOM.createPortal(
        <div className="bin-confirm-backdrop" onClick={() => !manager.deleting && manager.setConfirmItem(null)}>
            <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                <h3>Remove {typeLabel}?</h3>
                <p className="bin-confirm-name">"{manager.confirmItem.name}"</p>
                <p className="bin-confirm-warning">Moved to Recovery Bin. Items using it are unaffected.</p>
                <div className="bin-confirm-actions">
                    <button className="bin-btn-cancel" onClick={() => manager.setConfirmItem(null)} disabled={manager.deleting}>Cancel</button>
                    <button className="bin-btn-delete" onClick={() => manager.confirmDelete(onRemoved)} disabled={manager.deleting}>
                        {manager.deleting ? <><i className="fa-solid fa-circle-notch fa-spin" /> Removing…</> : <><i className="fa-solid fa-trash" /> Yes, Remove</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
