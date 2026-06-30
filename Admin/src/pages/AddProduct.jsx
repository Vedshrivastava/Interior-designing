import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const FALLBACK_CATEGORIES = ['Interior', 'Exterior', 'Functional Architecture'];
const FALLBACK_SUBCATEGORIES = ['Ceilings', 'Wall Features', 'Flooring', 'Lighting', 'Furniture', 'Facades', 'Cladding', 'Landscaping', 'Pergolas', 'Breeze Blocks', 'Jaali Walls', 'Decorative Screens', 'Feature Walls', 'Privacy Screens'];

const FALLBACK_SPECIALITIES = [
    'Waterproof', 'UV Protection', 'Fire Resistant', 'Weather Resistant',
    'Eco-Friendly', 'Low Maintenance', 'Anti-Fungal', 'Sound Insulation',
    'Thermal Insulation', 'Scratch Resistant', 'Fade Resistant',
    'Customizable', 'Non-Toxic', 'Rust Resistant',
];

const FALLBACK_APPLICATIONS = [
    'Residential', 'Commercial', 'Hospitality', 'Office',
    'Retail', 'Healthcare', 'Outdoor', 'Garden',
    'Rooftop', 'Balcony', 'Industrial', 'Education',
];

const FALLBACK_MATERIALS = [
    'Concrete', 'Teak Wood', 'Mild Steel', 'Brass', 'Glass', 'Marble',
    'Granite', 'MDF', 'Plywood', 'Laminate', 'Fabric', 'Leather',
    'Aluminium', 'Stainless Steel',
];

const FALLBACK_FINISHES = [
    'Matte', 'Polished', 'Glossy', 'Textured', 'Brushed', 'Rough Cast',
    'Natural', 'Lacquered', 'Antique', 'Powder Coated',
];

// Iconify helpers
const iconifyImgUrl = (iconId) => {
  if (!iconId || !iconId.includes(':')) return null;
  const [prefix, name] = iconId.split(':');
  return `https://api.iconify.design/${prefix}/${name}.svg`;
};

// Inline-styled so they can never be affected by unrelated CSS rules
// elsewhere in the bundle (this app ships one global stylesheet for
// every page, so class-based styling here is exposed to the entire
// app's CSS, not just this file).
const imgToolBtnStyle = (disabled) => ({
    width: 26, height: 26, minWidth: 26, minHeight: 26, maxWidth: 26, maxHeight: 26,
    boxSizing: 'border-box',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: disabled ? '#f3f1ec' : '#ffffff',
    border: '1px solid rgba(16,37,37,0.16)',
    boxShadow: disabled ? 'none' : '0 1px 3px rgba(16,37,37,0.1)',
    color: disabled ? '#bdb6ab' : '#5a4e44',
    padding: 0,
    margin: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    pointerEvents: disabled ? 'none' : 'auto',
    flexShrink: 0,
});

const ChevronIcon = ({ dir }) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {dir === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
);

const imgOrderBadgeStyle = {
    position: 'absolute', top: -8, left: -8,
    width: 22, height: 22, minWidth: 22, minHeight: 22,
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#102525', color: '#e8d0a8',
    fontSize: 11, fontWeight: 700, lineHeight: 1,
    border: '2px solid #ffffff',
    boxShadow: '0 1px 3px rgba(16,37,37,0.15)',
    zIndex: 1,
};

const COLOR_OPTIONS = [
    '#3b82f6', '#f59e0b', '#ef4444', '#6366f1', '#22c55e',
    '#8b5cf6', '#14b8a6', '#ec4899', '#f97316', '#64748b',
    '#a78bfa', '#c9a87c', '#10b981', '#78716c', '#0ea5e9',
    '#dc2626', '#16a34a', '#9333ea', '#0891b2', '#d97706',
];

/* ── Reusable manager hook for DB-driven icon+colour tag lists (specialities, applications, categories, subcategories) ──
   getExtraPayload: optional fn returning extra fields merged into the POST body on save (e.g. parent categories for subcategories) */
function useIconTagManager(url, token, apiBase, fallbackNames, getExtraPayload) {
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
function IconTagSection({ label, hint, placeholder, manager, selected, onToggle, fixedColor, singular }) {
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

/* ── Subcategory dropdown: single-select, icon-aware, with inline
   "add new" form that includes a parent-category multi-select checklist ── */
function SubcategorySection({ subManager, catManager, values, onToggle, availableForCategories, dropdownOpen, setDropdownOpen, dropRef, newParentCats, setNewParentCats }) {
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
function ConfirmTagDeleteModal({ manager, typeLabel, onRemoved }) {
    if (!manager.confirmItem) return null;
    return ReactDOM.createPortal(
        <div className="bin-confirm-backdrop" onClick={() => !manager.deleting && manager.setConfirmItem(null)}>
            <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                <h3>Remove {typeLabel}?</h3>
                <p className="bin-confirm-name">"{manager.confirmItem.name}"</p>
                <p className="bin-confirm-warning">Moved to Recovery Bin. Products using it are unaffected.</p>
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

const AddProduct = ({ url, setIsLoading, isLoading }) => {
    const [images, setImages] = useState([]);
    const [data, setData] = useState({
        name:         '',
        description:  '',
        categories:   [],
        subcategories: [],
        materials:    [],
        finishes:     [],
        specialities: [],
        applications: [],
        isFeatured:   false,
    });
    const [points, setPoints] = useState(['']);

    const [subCatOpen, setSubCatOpen] = useState(false);
    const subCatRef = useRef(null);
    const catSectionRef = useRef(null);
    const [newParentCats, setNewParentCats] = useState([]);

    const token = localStorage.getItem('token');

    const specManager = useIconTagManager(url, token, '/api/speciality',  FALLBACK_SPECIALITIES);
    const appManager  = useIconTagManager(url, token, '/api/application', FALLBACK_APPLICATIONS);
    const catManager  = useIconTagManager(url, token, '/api/product-category', FALLBACK_CATEGORIES);
    const subManager  = useIconTagManager(url, token, '/api/product-subcategory', FALLBACK_SUBCATEGORIES, () => ({ categories: newParentCats }));
    const materialManager = useIconTagManager(url, token, '/api/material', FALLBACK_MATERIALS);
    const finishManager   = useIconTagManager(url, token, '/api/finish',   FALLBACK_FINISHES);

    useEffect(() => {
        const handler = (e) => {
            const insideSubCat = subCatRef.current && subCatRef.current.contains(e.target);
            const insideCatSection = catSectionRef.current && catSectionRef.current.contains(e.target);
            if (!insideSubCat && !insideCatSection) setSubCatOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleCategory = (cat) => {
        setData(prev => {
            const next = prev.categories.includes(cat)
                ? prev.categories.filter(c => c !== cat)
                : [...prev.categories, cat];
            const validSubNames = subManager.objects.filter(s => s.categories?.some(c => next.includes(c))).map(s => s.name);
            return {
                ...prev,
                categories: next,
                subcategories: prev.subcategories.filter(s => validSubNames.includes(s)),
            };
        });
    };

    const onChange = (e) => {
        const { name, value, type, checked } = e.target;
        setData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const toggleChip = (field, val) => {
        setData(prev => ({
            ...prev,
            [field]: prev[field].includes(val)
                ? prev[field].filter(v => v !== val)
                : [...prev[field], val],
        }));
    };

    const onPointChange  = (i, v) => { const p = [...points]; p[i] = v; setPoints(p); };
    const addPoint       = ()     => setPoints([...points, '']);
    const removePoint    = (i)    => setPoints(points.filter((_, idx) => idx !== i));
    const onImageChange  = (e)    => setImages(prev => [...prev, ...Array.from(e.target.files)]);
    const removeImage    = (i)    => setImages(images.filter((_, idx) => idx !== i));
    const moveImage = (index, direction) => {
        setImages(prev => {
            const next = [...prev];
            const target = index + direction;
            if (target < 0 || target >= next.length) return prev;
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const fd = new FormData();
        fd.append('name',         data.name);
        fd.append('description',  data.description);
        fd.append('categories',   JSON.stringify(data.categories));
        fd.append('subcategories', JSON.stringify(data.subcategories));
        fd.append('materials',    JSON.stringify(data.materials));
        fd.append('finishes',     JSON.stringify(data.finishes));
        fd.append('specialities', JSON.stringify(data.specialities));
        fd.append('applications', JSON.stringify(data.applications));
        fd.append('points',       JSON.stringify(points.filter(p => p.trim())));
        fd.append('isFeatured',   data.isFeatured);
        images.forEach(img => fd.append('images', img));

        try {
            const res = await axios.post(`${url}/api/product/add`, fd, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                setData({
                    name: '', description: '', categories: [], subcategories: [],
                    materials: [], finishes: [], specialities: [], applications: [], isFeatured: false,
                });
                setPoints(['']);
                setImages([]);
                toast.success(res.data.message);
            } else {
                toast.error(res.data.message);
            }
        } catch {
            toast.error('An error occurred while adding the product.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
        <div className="add">
            <form className="flex-col" onSubmit={onSubmit}>

                {/* ── Images ── */}
                <div className="add-img-upload flex-col">
                    <h2>Product Images {images.length > 1 && <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#888' }}>— number shows display order on the site</span>}</h2>
                    <label htmlFor="prod-image" className="upload-icon">
                        <i className="fa fa-upload" />
                    </label>
                    <input onChange={onImageChange} type="file" id="prod-image" multiple hidden />
                    <div className="selected-images">
                        {images.map((img, i) => (
                            <div key={i} className="image-preview" style={{ alignItems: 'center', gap: '8px' }}>
                                {images.length > 1 && <span style={imgOrderBadgeStyle}>{i + 1}</span>}
                                <img src={URL.createObjectURL(img)} alt={`img-${i}`} className="thumbnail" />
                                <button type="button" onClick={() => removeImage(i)} className="remove-btn">X</button>
                                {images.length > 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <button type="button" style={imgToolBtnStyle(i === 0)} disabled={i === 0}
                                            onClick={() => moveImage(i, -1)} title="Move earlier">
                                            <ChevronIcon dir="left" />
                                        </button>
                                        <button type="button" style={imgToolBtnStyle(i === images.length - 1)} disabled={i === images.length - 1}
                                            onClick={() => moveImage(i, 1)} title="Move later">
                                            <ChevronIcon dir="right" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Name ── */}
                <div className="add-product-name flex-col">
                    <h2>Product Name</h2>
                    <input name="name" value={data.name} onChange={onChange} type="text" placeholder="e.g. Concrete Breeze Block Panel" required />
                </div>

                {/* ── Description ── */}
                <div className="add-product-description flex-col">
                    <h2>Description</h2>
                    <textarea name="description" value={data.description} onChange={onChange} rows="5" placeholder="Describe the product — its look, function, and unique qualities…" required />
                </div>

                {/* ── Categories (multi-select) ── */}
                <div ref={catSectionRef}>
                    <IconTagSection
                        label="Categories"
                        hint="(select all that apply)"
                        placeholder="Category name e.g. Landscaping Elements"
                        manager={catManager}
                        selected={data.categories}
                        onToggle={toggleCategory}
                    />
                </div>

                {/* ── Subcategories ── */}
                {data.categories.length > 0 && (
                    <SubcategorySection
                        subManager={subManager}
                        catManager={catManager}
                        values={data.subcategories}
                        onToggle={(name) => toggleChip('subcategories', name)}
                        availableForCategories={data.categories}
                        dropdownOpen={subCatOpen}
                        setDropdownOpen={setSubCatOpen}
                        dropRef={subCatRef}
                        newParentCats={newParentCats}
                        setNewParentCats={setNewParentCats}
                    />
                )}

                {/* ── Materials ── */}
                <IconTagSection
                    label="Materials"
                    hint="(select all that apply)"
                    placeholder="Material name e.g. Walnut Wood"
                    manager={materialManager}
                    selected={data.materials}
                    onToggle={(name) => toggleChip('materials', name)}
                />

                {/* ── Finishes ── */}
                <IconTagSection
                    label="Finishes"
                    hint="(select all that apply)"
                    placeholder="Finish name e.g. Satin"
                    manager={finishManager}
                    selected={data.finishes}
                    onToggle={(name) => toggleChip('finishes', name)}
                    singular="finish"
                />

                {/* ── Specialities ── */}
                <IconTagSection
                    label="Specialities"
                    placeholder="Speciality name e.g. Anti-Static"
                    manager={specManager}
                    selected={data.specialities}
                    onToggle={(name) => toggleChip('specialities', name)}
                />

                {/* ── Applications ── */}
                <IconTagSection
                    label="Applications"
                    placeholder="Application name e.g. Spa"
                    manager={appManager}
                    selected={data.applications}
                    onToggle={(name) => toggleChip('applications', name)}
                    fixedColor="#c9a87c"
                />

                {/* ── Key Highlights ── */}
                <div className="add-product-points flex-col">
                    <h2>Key Highlights</h2>
                    {points.map((pt, i) => (
                        <div key={i} className="point-input">
                            <input type="text" value={pt} onChange={e => onPointChange(i, e.target.value)} placeholder={`Highlight ${i + 1}`} />
                            <button type="button" onClick={() => removePoint(i)} className="remove-point-btn">Remove</button>
                        </div>
                    ))}
                    <button type="button" className="add-point-btn" onClick={addPoint}>+ Add Highlight</button>
                </div>

                {/* ── Featured card ── */}
                <label className={`add-feature-card${data.isFeatured ? ' active' : ''}`}>
                    <div className="add-feature-left">
                        <div className="add-feature-icon"><i className="fa fa-star" /></div>
                        <div className="add-feature-text">
                            <span className="add-feature-title">Feature on Products Page</span>
                            <span className="add-feature-desc">Mark as featured — this product will appear at the top of the products page.</span>
                        </div>
                    </div>
                    <input type="checkbox" name="isFeatured" checked={data.isFeatured} onChange={onChange} style={{ display: 'none' }} />
                    <span className="toggle-slider" />
                </label>

                <button type="submit" className="add-btn" disabled={isLoading}>
                    {isLoading ? 'Uploading…' : 'Add Product'}
                </button>

            </form>
        </div>

        <ConfirmTagDeleteModal manager={specManager} typeLabel="Speciality" onRemoved={(name) => setData(p => ({ ...p, specialities: p.specialities.filter(s => s !== name) }))} />
        <ConfirmTagDeleteModal manager={appManager}  typeLabel="Application" onRemoved={(name) => setData(p => ({ ...p, applications: p.applications.filter(a => a !== name) }))} />
        <ConfirmTagDeleteModal manager={catManager}  typeLabel="Category"    onRemoved={(name) => setData(p => ({ ...p, categories: p.categories.filter(c => c !== name) }))} />
        <ConfirmTagDeleteModal manager={subManager}  typeLabel="Subcategory" onRemoved={(name) => setData(p => ({ ...p, subcategories: p.subcategories.filter(s => s !== name) }))} />
        <ConfirmTagDeleteModal manager={materialManager} typeLabel="Material" onRemoved={(name) => setData(p => ({ ...p, materials: p.materials.filter(m => m !== name) }))} />
        <ConfirmTagDeleteModal manager={finishManager}   typeLabel="Finish"   onRemoved={(name) => setData(p => ({ ...p, finishes: p.finishes.filter(f => f !== name) }))} />
        </>
    );
};

export default AddProduct;
