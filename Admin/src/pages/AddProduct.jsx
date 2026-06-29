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

// Iconify helpers
const iconifyImgUrl = (iconId) => {
  if (!iconId || !iconId.includes(':')) return null;
  const [prefix, name] = iconId.split(':');
  return `https://api.iconify.design/${prefix}/${name}.svg`;
};
const iconifyColorUrl = (iconId, color) => {
  const base = iconifyImgUrl(iconId);
  return base ? `${base}?color=${encodeURIComponent(color)}` : null;
};

const APPLICATIONS = [
    'Residential', 'Commercial', 'Hospitality', 'Office',
    'Retail', 'Healthcare', 'Outdoor', 'Garden',
    'Rooftop', 'Balcony', 'Industrial', 'Education',
];

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

    // ── Specialities (DB-driven) ──
    const [specialityObjects, setSpecialityObjects] = useState([]);
    const [addingSpec,   setAddingSpec]   = useState(false);
    const [newSpecName,  setNewSpecName]  = useState('');
    const [newSpecIcon,  setNewSpecIcon]  = useState('');
    const [iconSearch,   setIconSearch]   = useState('');
    const [iconResults,  setIconResults]  = useState([]);
    const [iconLoading,  setIconLoading]  = useState(false);
    const iconDebounceRef = useRef(null);
    const [newSpecColor, setNewSpecColor] = useState('#c9a87c');
    const [specSaving,   setSpecSaving]   = useState(false);
    const [confirmSpec,  setConfirmSpec]  = useState(null);
    const [specDeleting, setSpecDeleting] = useState(false);

    const token = localStorage.getItem('token');

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

    const fetchSpecialities = async () => {
        try {
            const res = await axios.get(`${url}/api/speciality/list`);
            if (res.data.success) setSpecialityObjects(res.data.data);
        } catch { setSpecialityObjects(FALLBACK_SPECIALITIES.map((n, i) => ({ _id: n, name: n, icon: 'check', color: '#c9a87c', order: i }))); }
    };
    useEffect(() => { fetchSpecialities(); }, []);

    const searchIcons = async (query) => {
        if (!query.trim()) { setIconResults([]); return; }
        setIconLoading(true);
        try {
            const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=60`);
            const data = await res.json();
            setIconResults(data.icons || []);
        } catch { setIconResults([]); }
        finally { setIconLoading(false); }
    };

    // Debounce icon search
    useEffect(() => {
        clearTimeout(iconDebounceRef.current);
        iconDebounceRef.current = setTimeout(() => searchIcons(iconSearch), 350);
        return () => clearTimeout(iconDebounceRef.current);
    }, [iconSearch]);

    // Auto-search when name changes and form is open
    useEffect(() => {
        if (addingSpec && newSpecName.trim()) {
            const firstWord = newSpecName.trim().split(/\s+/)[0];
            setIconSearch(firstWord);
        }
    }, [newSpecName, addingSpec]);

    const saveNewSpec = async () => {
        if (!newSpecName.trim()) { toast.error('Name is required'); return; }
        setSpecSaving(true);
        try {
            const res = await axios.post(`${url}/api/speciality/add`,
                { name: newSpecName.trim(), icon: newSpecIcon, color: newSpecColor },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success(res.data.message);
                setNewSpecName(''); setNewSpecIcon('check'); setNewSpecColor('#c9a87c');
                setAddingSpec(false);
                await fetchSpecialities();
            } else { toast.error(res.data.message); }
        } catch { toast.error('Failed to add speciality'); }
        finally { setSpecSaving(false); }
    };

    const confirmDeleteSpec = async () => {
        if (!confirmSpec || specDeleting) return;
        setSpecDeleting(true);
        try {
            const res = await axios.post(`${url}/api/speciality/remove`,
                { _id: confirmSpec._id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success(res.data.message);
                setData(p => ({ ...p, specialities: p.specialities.filter(s => s !== confirmSpec.name) }));
                setConfirmSpec(null);
                await fetchSpecialities();
            } else { toast.error(res.data.message); }
        } catch { toast.error('Failed to remove'); }
        finally { setSpecDeleting(false); }
    };

    const toggleCategory = (cat) => {
        setData(prev => {
            const next = prev.categories.includes(cat)
                ? prev.categories.filter(c => c !== cat)
                : [...prev.categories, cat];
            // Reset subcategory if it no longer belongs to selected cats
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
                <div className="add-multi-section flex-col">
                    <h2>Specialities</h2>
                    <div className="add-multi-grid">
                        {specialityObjects.map(spec => {
                            const selected = data.specialities.includes(spec.name);
                            const iconUrl = iconifyImgUrl(spec.icon);
                            return (
                                <div key={spec._id} className="spec-chip-wrap">
                                    <button type="button"
                                        className={`add-multi-chip spec-chip${selected ? ' active' : ''}`}
                                        style={selected ? { background: `${spec.color}22`, borderColor: `${spec.color}88`, color: spec.color } : {}}
                                        onClick={() => toggleChip('specialities', spec.name)}>
                                        {iconUrl && <img src={selected ? `${iconUrl}?color=${encodeURIComponent(spec.color)}` : iconUrl} width={13} height={13} alt="" style={{ flexShrink: 0 }} />}
                                        {spec.name}
                                    </button>
                                    <button type="button" className="spec-trash-btn"
                                        title={`Remove "${spec.name}"`}
                                        onClick={() => setConfirmSpec(spec)}>
                                        <i className="fa-solid fa-trash" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Add new speciality */}
                    {!addingSpec ? (
                        <button type="button" className="add-point-btn" style={{ marginTop: '10px' }} onClick={() => { setAddingSpec(true); setNewSpecIcon(''); setIconSearch(''); setIconResults([]); }}>
                            <i className="fa fa-plus" /> Add new speciality
                        </button>
                    ) : (
                        <div className="spec-add-form">
                            <input
                                type="text" placeholder="Speciality name e.g. Anti-Static"
                                value={newSpecName} onChange={e => setNewSpecName(e.target.value)}
                                autoFocus
                            />
                            <p className="spec-form-label">Pick an icon</p>

                            {/* Iconify live search */}
                            <div className="spec-icon-search-wrap">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    type="text"
                                    placeholder="Search 200,000+ icons… e.g. water, fire, eco, shield"
                                    value={iconSearch}
                                    onChange={e => setIconSearch(e.target.value)}
                                />
                                {iconLoading && <i className="fa-solid fa-circle-notch fa-spin" style={{ color: 'var(--text-lt)', fontSize: '0.75rem', flexShrink: 0 }} />}
                                {iconSearch && !iconLoading && <button type="button" className="spec-icon-search-clear" onClick={() => { setIconSearch(''); setIconResults([]); }}>×</button>}
                            </div>

                            {/* Results grid */}
                            <div className="spec-icon-grid-wrap">
                                {iconResults.length === 0 && !iconLoading && iconSearch && (
                                    <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-lt)', textAlign: 'center', padding: '16px 0', margin: 0 }}>No icons found — try a different word</p>
                                )}
                                {iconResults.length === 0 && !iconLoading && !iconSearch && (
                                    <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-lt)', textAlign: 'center', padding: '16px 0', margin: 0 }}>
                                        <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '6px', color: 'var(--gold)' }} />
                                        Type the speciality name — icons will auto-appear
                                    </p>
                                )}
                                {iconResults.length > 0 && (
                                    <div className="spec-icon-grid spec-icon-grid--full">
                                        {iconResults.map(iconId => {
                                            const url = iconifyImgUrl(iconId);
                                            const shortName = iconId.split(':')[1] || iconId;
                                            return (
                                                <button key={iconId} type="button"
                                                    className={`spec-icon-btn${newSpecIcon === iconId ? ' active' : ''}`}
                                                    title={iconId}
                                                    onClick={() => setNewSpecIcon(iconId)}>
                                                    <img src={newSpecIcon === iconId ? `${url}?color=%23fff` : url} width={20} height={20} alt={shortName} />
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
                                        className={`spec-color-swatch${newSpecColor === c ? ' active' : ''}`}
                                        style={{ background: c }}
                                        onClick={() => setNewSpecColor(c)} />
                                ))}
                            </div>

                            {/* Live preview */}
                            <div className="spec-preview">
                                Preview:{' '}
                                <span className="spec-preview-badge" style={{ background: `${newSpecColor}22`, borderColor: `${newSpecColor}88`, color: newSpecColor }}>
                                    {newSpecIcon && iconifyImgUrl(newSpecIcon) && (
                                        <img src={`${iconifyImgUrl(newSpecIcon)}?color=${encodeURIComponent(newSpecColor)}`} width={13} height={13} alt="" />
                                    )}
                                    {newSpecName || 'Name'}
                                </span>
                                {!newSpecIcon && <span style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.72rem', color: 'var(--text-lt)', marginLeft: '8px' }}>← pick an icon above</span>}
                            </div>

                            <div className="add-cat-new-actions" style={{ marginTop: '10px' }}>
                                <button type="button" className="add-cat-save-btn" onClick={saveNewSpec} disabled={specSaving}>{specSaving ? 'Saving…' : 'Save'}</button>
                                <button type="button" className="add-cat-cancel-btn" onClick={() => { setAddingSpec(false); setNewSpecName(''); setNewSpecIcon(''); setNewSpecColor('#c9a87c'); setIconSearch(''); setIconResults([]); }}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Applications ── */}
                <div className="add-multi-section flex-col">
                    <h2>Applications</h2>
                    <div className="add-multi-grid">
                        {APPLICATIONS.map(app => (
                            <button key={app} type="button"
                                className={`add-multi-chip${data.applications.includes(app) ? ' active' : ''}`}
                                onClick={() => toggleChip('applications', app)}>
                                {app}
                            </button>
                        ))}
                    </div>
                </div>

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

        {confirmSpec && ReactDOM.createPortal(
            <div className="bin-confirm-backdrop" onClick={() => !specDeleting && setConfirmSpec(null)}>
                <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                    <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                    <h3>Remove Speciality?</h3>
                    <p className="bin-confirm-name">"{confirmSpec.name}"</p>
                    <p className="bin-confirm-warning">Moved to Recovery Bin. Products using it are unaffected.</p>
                    <div className="bin-confirm-actions">
                        <button className="bin-btn-cancel" onClick={() => setConfirmSpec(null)} disabled={specDeleting}>Cancel</button>
                        <button className="bin-btn-delete" onClick={confirmDeleteSpec} disabled={specDeleting}>
                            {specDeleting ? <><i className="fa-solid fa-circle-notch fa-spin" /> Removing…</> : <><i className="fa-solid fa-trash" /> Yes, Remove</>}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}
        </>
    );
};

export default AddProduct;
