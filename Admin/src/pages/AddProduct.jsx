import React, { useState, useRef, useEffect } from 'react';
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

const SPECIALITIES = [
    'Waterproof', 'UV Protection', 'Fire Resistant', 'Weather Resistant',
    'Eco-Friendly', 'Low Maintenance', 'Anti-Fungal', 'Sound Insulation',
    'Thermal Insulation', 'Scratch Resistant', 'Fade Resistant',
    'Customizable', 'Non-Toxic', 'Rust Resistant',
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
        category:     CATEGORIES[0],
        subcategory:  SUBCATEGORIES[CATEGORIES[0]][0],
        material:     '',
        finish:       '',
        specialities: [],
        applications: [],
        isFeatured:   false,
    });
    const [points, setPoints] = useState(['']);

    // Category dropdown
    const [catOpen,    setCatOpen]    = useState(false);
    const [subCatOpen, setSubCatOpen] = useState(false);
    const catRef    = useRef(null);
    const subCatRef = useRef(null);

    const token = localStorage.getItem('token');

    useEffect(() => {
        const handler = (e) => {
            if (catRef.current    && !catRef.current.contains(e.target))    setCatOpen(false);
            if (subCatRef.current && !subCatRef.current.contains(e.target)) setSubCatOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleCategorySelect = (cat) => {
        setData(prev => ({ ...prev, category: cat, subcategory: SUBCATEGORIES[cat][0] }));
        setCatOpen(false);
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
        fd.append('category',     data.category);
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
                    name: '', description: '', category: CATEGORIES[0],
                    subcategory: SUBCATEGORIES[CATEGORIES[0]][0],
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

                {/* ── Category + Subcategory ── */}
                <div className="add-category-price">
                    <div className="add-cat-dropdown-wrap flex-col">
                        <h2>Category</h2>
                        <div className="add-cat-dropdown" ref={catRef}>
                            <button type="button" className={`add-cat-trigger${catOpen ? ' open' : ''}`} onClick={() => setCatOpen(o => !o)}>
                                <span>{data.category}</span>
                                <i className="fa fa-chevron-down" />
                            </button>
                            {catOpen && (
                                <ul className="add-cat-list">
                                    {CATEGORIES.map((cat, i) => (
                                        <li key={i} className={`add-cat-option${data.category === cat ? ' active' : ''}`} onClick={() => handleCategorySelect(cat)}>
                                            <span>{cat}</span>
                                            {data.category === cat && <i className="fa fa-check" />}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="add-cat-dropdown-wrap flex-col">
                        <h2>Subcategory</h2>
                        <div className="add-cat-dropdown" ref={subCatRef}>
                            <button type="button" className={`add-cat-trigger${subCatOpen ? ' open' : ''}`} onClick={() => setSubCatOpen(o => !o)}>
                                <span>{data.subcategory}</span>
                                <i className="fa fa-chevron-down" />
                            </button>
                            {subCatOpen && (
                                <ul className="add-cat-list">
                                    {SUBCATEGORIES[data.category].map((sub, i) => (
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
                </div>

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
                        {SPECIALITIES.map(spec => (
                            <button key={spec} type="button"
                                className={`add-multi-chip${data.specialities.includes(spec) ? ' active' : ''}`}
                                onClick={() => toggleChip('specialities', spec)}>
                                {spec}
                            </button>
                        ))}
                    </div>
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
    );
};

export default AddProduct;
