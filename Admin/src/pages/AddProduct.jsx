import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const SUBCATEGORIES = {
    'Interior':               ['Ceilings', 'Wall Features', 'Flooring', 'Lighting', 'Furniture'],
    'Exterior':               ['Facades', 'Cladding', 'Landscaping', 'Pergolas'],
    'Functional Architecture':['Breeze Blocks', 'Jaali Walls', 'Decorative Screens', 'Feature Walls', 'Privacy Screens'],
};
const CATEGORIES = Object.keys(SUBCATEGORIES);

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

// Iconify helpers
const iconifyImgUrl = (iconId) => {
  if (!iconId || !iconId.includes(':')) return null;
  const [prefix, name] = iconId.split(':');
  return `https://api.iconify.design/${prefix}/${name}.svg`;
};

const COLOR_OPTIONS = [
    '#3b82f6', '#f59e0b', '#ef4444', '#6366f1', '#22c55e',
    '#8b5cf6', '#14b8a6', '#ec4899', '#f97316', '#64748b',
    '#a78bfa', '#c9a87c', '#10b981', '#78716c', '#0ea5e9',
    '#dc2626', '#16a34a', '#9333ea', '#0891b2', '#d97706',
];

/* ── Reusable manager hook for DB-driven icon+colour tag lists (specialities, applications) ── */
function useIconTagManager(url, token, apiBase, fallbackNames) {
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
            const res = await axios.post(`${url}${apiBase}/add`,
                { name: newName.trim(), icon: newIcon, color: newColor },
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
function IconTagSection({ label, placeholder, manager, selected, onToggle, fixedColor }) {
    return (
        <div className="add-multi-section flex-col">
            <h2>{label}</h2>
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
                    <i className="fa fa-plus" /> Add new {label.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '')}
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
        subcategory:  '',
        material:     '',
        finish:       '',
        specialities: [],
        applications: [],
        isFeatured:   false,
    });
    const [points, setPoints] = useState(['']);

    const [subCatOpen, setSubCatOpen] = useState(false);
    const subCatRef = useRef(null);

    const token = localStorage.getItem('token');

    const specManager = useIconTagManager(url, token, '/api/speciality',  FALLBACK_SPECIALITIES);
    const appManager  = useIconTagManager(url, token, '/api/application', FALLBACK_APPLICATIONS);

    // Merge subcategories from all selected categories
    const availableSubcats = data.categories.length > 0
        ? [...new Set(data.categories.flatMap(cat => SUBCATEGORIES[cat] || []))]
        : [];

    useEffect(() => {
        const handler = (e) => {
            if (subCatRef.current && !subCatRef.current.contains(e.target)) setSubCatOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleCategory = (cat) => {
        setData(prev => {
            const next = prev.categories.includes(cat)
                ? prev.categories.filter(c => c !== cat)
                : [...prev.categories, cat];
            const nextSubcats = [...new Set(next.flatMap(c => SUBCATEGORIES[c] || []))];
            return {
                ...prev,
                categories: next,
                subcategory: nextSubcats.includes(prev.subcategory) ? prev.subcategory : (nextSubcats[0] || ''),
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

    const onSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const fd = new FormData();
        fd.append('name',         data.name);
        fd.append('description',  data.description);
        fd.append('categories',   JSON.stringify(data.categories));
        fd.append('subcategory',  data.subcategory);
        fd.append('material',     data.material);
        fd.append('finish',       data.finish);
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
                    name: '', description: '', categories: [], subcategory: '',
                    material: '', finish: '', specialities: [], applications: [], isFeatured: false,
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
                    <h2>Product Images</h2>
                    <label htmlFor="prod-image" className="upload-icon">
                        <i className="fa fa-upload" />
                    </label>
                    <input onChange={onImageChange} type="file" id="prod-image" multiple hidden />
                    <div className="selected-images">
                        {images.map((img, i) => (
                            <div key={i} className="image-preview">
                                <img src={URL.createObjectURL(img)} alt={`img-${i}`} className="thumbnail" />
                                <button type="button" onClick={() => removeImage(i)} className="remove-btn">X</button>
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
                <div className="add-multi-section flex-col">
                    <h2>Categories <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#888' }}>(select all that apply)</span></h2>
                    <div className="add-multi-grid">
                        {CATEGORIES.map(cat => (
                            <button key={cat} type="button"
                                className={`add-multi-chip${data.categories.includes(cat) ? ' active' : ''}`}
                                onClick={() => toggleCategory(cat)}>
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Subcategory ── */}
                {availableSubcats.length > 0 && (
                    <div className="add-cat-dropdown-wrap flex-col">
                        <h2>Subcategory</h2>
                        <div className="add-cat-dropdown" ref={subCatRef}>
                            <button type="button" className={`add-cat-trigger${subCatOpen ? ' open' : ''}`} onClick={() => setSubCatOpen(o => !o)}>
                                <span>{data.subcategory || 'Select subcategory'}</span>
                                <i className="fa fa-chevron-down" />
                            </button>
                            {subCatOpen && (
                                <ul className="add-cat-list">
                                    {availableSubcats.map((sub, i) => (
                                        <li key={i} className={`add-cat-option${data.subcategory === sub ? ' active' : ''}`}
                                            onClick={() => { setData(prev => ({ ...prev, subcategory: sub })); setSubCatOpen(false); }}>
                                            <span>{sub}</span>
                                            {data.subcategory === sub && <i className="fa fa-check" />}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Material + Finish ── */}
                <div className="add-category-price">
                    <div className="add-category flex-col">
                        <h2>Material</h2>
                        <input name="material" value={data.material} onChange={onChange} type="text" placeholder="e.g. Concrete, Teak Wood, Mild Steel" />
                    </div>
                    <div className="add-category flex-col">
                        <h2>Finish</h2>
                        <input name="finish" value={data.finish} onChange={onChange} type="text" placeholder="e.g. Matte, Polished, Rough Cast" />
                    </div>
                </div>

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
        </>
    );
};

export default AddProduct;
