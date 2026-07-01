import React, { useState, useRef, useEffect } from 'react';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useIconTagManager, IconTagSection, SubcategorySection, ConfirmTagDeleteModal } from '../components/IconTagManager';

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
