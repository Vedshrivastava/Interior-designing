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

// Available icons for the picker
const ICON_OPTIONS = [
    { key: 'droplet',      fa: 'fa-droplet',           label: 'Water'      },
    { key: 'sun',          fa: 'fa-sun',               label: 'Sun'        },
    { key: 'fire',         fa: 'fa-fire',              label: 'Fire'       },
    { key: 'cloud',        fa: 'fa-cloud',             label: 'Cloud'      },
    { key: 'leaf',         fa: 'fa-leaf',              label: 'Leaf'       },
    { key: 'shield',       fa: 'fa-shield',            label: 'Shield'     },
    { key: 'volume-off',   fa: 'fa-volume-xmark',      label: 'Sound'      },
    { key: 'thermometer',  fa: 'fa-temperature-half',  label: 'Temp'       },
    { key: 'pen',          fa: 'fa-pen',               label: 'Pen'        },
    { key: 'check',        fa: 'fa-check',             label: 'Check'      },
    { key: 'wrench',       fa: 'fa-screwdriver-wrench',label: 'Wrench'     },
    { key: 'ruler',        fa: 'fa-ruler',             label: 'Ruler'      },
    { key: 'star',         fa: 'fa-star',              label: 'Star'       },
    { key: 'gem',          fa: 'fa-gem',               label: 'Gem'        },
    { key: 'eye',          fa: 'fa-eye',               label: 'Eye'        },
    { key: 'lightbulb',    fa: 'fa-lightbulb',         label: 'Bulb'       },
    { key: 'recycle',      fa: 'fa-recycle',           label: 'Recycle'    },
    { key: 'lock',         fa: 'fa-lock',              label: 'Lock'       },
];

const COLOR_OPTIONS = [
    '#3b82f6', '#f59e0b', '#ef4444', '#6366f1', '#22c55e',
    '#8b5cf6', '#14b8a6', '#ec4899', '#f97316', '#64748b',
    '#a78bfa', '#c9a87c', '#10b981', '#78716c', '#0ea5e9',
];

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
    const [newSpecIcon,  setNewSpecIcon]  = useState('check');
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
                            const icon = ICON_OPTIONS.find(i => i.key === spec.icon);
                            const selected = data.specialities.includes(spec.name);
                            return (
                                <div key={spec._id} className="spec-chip-wrap">
                                    <button type="button"
                                        className={`add-multi-chip spec-chip${selected ? ' active' : ''}`}
                                        style={selected ? { background: `${spec.color}22`, borderColor: `${spec.color}88`, color: spec.color } : {}}
                                        onClick={() => toggleChip('specialities', spec.name)}>
                                        {icon && <i className={`fa-solid ${icon.fa}`} style={{ color: selected ? spec.color : undefined }} />}
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
                        <button type="button" className="add-point-btn" style={{ marginTop: '10px' }} onClick={() => setAddingSpec(true)}>
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
                            <div className="spec-icon-grid">
                                {ICON_OPTIONS.map(opt => (
                                    <button key={opt.key} type="button"
                                        className={`spec-icon-btn${newSpecIcon === opt.key ? ' active' : ''}`}
                                        title={opt.label}
                                        onClick={() => setNewSpecIcon(opt.key)}>
                                        <i className={`fa-solid ${opt.fa}`} />
                                        <span>{opt.label}</span>
                                    </button>
                                ))}
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
                            {/* Preview */}
                            <div className="spec-preview">
                                Preview: <span className="spec-preview-badge" style={{ background: `${newSpecColor}22`, borderColor: `${newSpecColor}88`, color: newSpecColor }}>
                                    {ICON_OPTIONS.find(i => i.key === newSpecIcon) && <i className={`fa-solid ${ICON_OPTIONS.find(i => i.key === newSpecIcon).fa}`} />}
                                    {newSpecName || 'Name'}
                                </span>
                            </div>
                            <div className="add-cat-new-actions" style={{ marginTop: '10px' }}>
                                <button type="button" className="add-cat-save-btn" onClick={saveNewSpec} disabled={specSaving}>{specSaving ? 'Saving…' : 'Save'}</button>
                                <button type="button" className="add-cat-cancel-btn" onClick={() => { setAddingSpec(false); setNewSpecName(''); setNewSpecIcon('check'); setNewSpecColor('#c9a87c'); }}>Cancel</button>
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
