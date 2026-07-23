import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import '../styles/list.css';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useWebSocket } from '../hooks/useWebSocket';

const FALLBACK_CATEGORIES = ['Interior', 'Exterior', 'Functional Architecture'];
const FALLBACK_SUBCATEGORIES = ['Ceilings', 'Wall Features', 'Flooring', 'Lighting', 'Furniture', 'Facades', 'Cladding', 'Landscaping', 'Pergolas', 'Breeze Blocks', 'Jaali Walls', 'Decorative Screens', 'Feature Walls', 'Privacy Screens'];

const FALLBACK_MATERIALS = ['Concrete', 'Teak Wood', 'Mild Steel', 'Brass', 'Glass', 'Marble', 'Granite', 'MDF', 'Plywood', 'Laminate', 'Fabric', 'Leather', 'Aluminium', 'Stainless Steel'];
const FALLBACK_FINISHES = ['Matte', 'Polished', 'Glossy', 'Textured', 'Brushed', 'Rough Cast', 'Natural', 'Lacquered', 'Antique', 'Powder Coated'];

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
    textDecoration: 'none',
    flexShrink: 0,
});

const ChevronIcon = ({ dir }) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {dir === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
);

const DownloadIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><path d="M5 19h14" />
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

const ListProducts = ({ url, setIsLoading, isLoading }) => {
    const [list,         setList]         = useState([]);
    const [activeFilter, setActiveFilter] = useState('All');
    const [query, setQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;
    const mobileBarRef = useRef(null);
    const token = localStorage.getItem('token');

    /* ── Specialities / Applications / Categories / Subcategories (DB-driven, for edit modal + filters) ── */
    const [specialityObjects, setSpecialityObjects] = useState([]);
    const [applicationObjects, setApplicationObjects] = useState([]);
    const [productCategoryObjects, setProductCategoryObjects] = useState([]);
    const [productSubcategoryObjects, setProductSubcategoryObjects] = useState([]);
    const [materialObjects, setMaterialObjects] = useState([]);
    const [finishObjects, setFinishObjects] = useState([]);

    const fetchSpecialityObjects = useCallback(() => {
        axios.get(`${url}/api/speciality/list`)
            .then(r => { if (r.data.success) setSpecialityObjects(r.data.data); })
            .catch(() => setSpecialityObjects(FALLBACK_SPECIALITIES.map((n, i) => ({ _id: n, name: n, icon: 'check', color: '#c9a87c', order: i }))));
    }, [url]);

    const fetchApplicationObjects = useCallback(() => {
        axios.get(`${url}/api/application/list`)
            .then(r => { if (r.data.success) setApplicationObjects(r.data.data); })
            .catch(() => setApplicationObjects(FALLBACK_APPLICATIONS.map((n, i) => ({ _id: n, name: n, icon: 'check', color: '#c9a87c', order: i }))));
    }, [url]);

    const fetchProductCategoryObjects = useCallback(() => {
        axios.get(`${url}/api/product-category/list`)
            .then(r => { if (r.data.success) setProductCategoryObjects(r.data.data); })
            .catch(() => setProductCategoryObjects(FALLBACK_CATEGORIES.map((n, i) => ({ _id: n, name: n, icon: 'check', color: '#c9a87c', order: i }))));
    }, [url]);

    const fetchProductSubcategoryObjects = useCallback(() => {
        axios.get(`${url}/api/product-subcategory/list`)
            .then(r => { if (r.data.success) setProductSubcategoryObjects(r.data.data); })
            .catch(() => setProductSubcategoryObjects(FALLBACK_SUBCATEGORIES.map((n, i) => ({ _id: n, name: n, icon: 'check', color: '#c9a87c', categories: [], order: i }))));
    }, [url]);

    const fetchMaterialObjects = useCallback(() => {
        axios.get(`${url}/api/material/list`)
            .then(r => { if (r.data.success) setMaterialObjects(r.data.data); })
            .catch(() => setMaterialObjects(FALLBACK_MATERIALS.map((n, i) => ({ _id: n, name: n, icon: 'check', color: '#c9a87c', order: i }))));
    }, [url]);

    const fetchFinishObjects = useCallback(() => {
        axios.get(`${url}/api/finish/list`)
            .then(r => { if (r.data.success) setFinishObjects(r.data.data); })
            .catch(() => setFinishObjects(FALLBACK_FINISHES.map((n, i) => ({ _id: n, name: n, icon: 'check', color: '#c9a87c', order: i }))));
    }, [url]);

    useEffect(() => {
        fetchSpecialityObjects();
        fetchApplicationObjects();
        fetchProductCategoryObjects();
        fetchProductSubcategoryObjects();
        fetchMaterialObjects();
        fetchFinishObjects();
    }, [fetchSpecialityObjects, fetchApplicationObjects, fetchProductCategoryObjects, fetchProductSubcategoryObjects, fetchMaterialObjects, fetchFinishObjects]);

    useWebSocket(useCallback((msg) => {
        if (msg.type === 'specialitiesChanged')         fetchSpecialityObjects();
        if (msg.type === 'applicationsChanged')          fetchApplicationObjects();
        if (msg.type === 'productCategoriesChanged')     fetchProductCategoryObjects();
        if (msg.type === 'productSubcategoriesChanged')  fetchProductSubcategoryObjects();
        if (msg.type === 'materialsChanged')             fetchMaterialObjects();
        if (msg.type === 'finishesChanged')              fetchFinishObjects();
    }, [fetchSpecialityObjects, fetchApplicationObjects, fetchProductCategoryObjects, fetchProductSubcategoryObjects, fetchMaterialObjects, fetchFinishObjects]));

    /* ── Lightbox ── */
    const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0, name: '' });
    const openLightbox  = (images, index, name) => { setLightbox({ open: true, images, index, name }); document.body.style.overflow = 'hidden'; };
    const closeLightbox = useCallback(() => { setLightbox({ open: false, images: [], index: 0, name: '' }); document.body.style.overflow = ''; }, []);
    const lbPrev = useCallback((e) => { e.stopPropagation(); setLightbox(p => ({ ...p, index: (p.index - 1 + p.images.length) % p.images.length })); }, []);
    const lbNext = useCallback((e) => { e.stopPropagation(); setLightbox(p => ({ ...p, index: (p.index + 1) % p.images.length })); }, []);

    useEffect(() => {
        if (!lightbox.open) return;
        const h = (e) => {
            if (e.key === 'Escape')     closeLightbox();
            if (e.key === 'ArrowLeft')  setLightbox(p => ({ ...p, index: (p.index - 1 + p.images.length) % p.images.length }));
            if (e.key === 'ArrowRight') setLightbox(p => ({ ...p, index: (p.index + 1) % p.images.length }));
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [lightbox.open, closeLightbox]);

    /* ── Edit modal ── */
    const blankEdit = {
        _id: '', name: '', description: '', categories: [],
        subcategories: [], materials: [], finishes: [],
        specialities: [], applications: [], points: [], isFeatured: false,
    };
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editData,   setEditData]   = useState(blankEdit);
    const [keptImages, setKeptImages] = useState([]);
    const [editImages, setEditImages] = useState([]);

    const [editSubCatOpen, setEditSubCatOpen] = useState(false);
    const editSubCatRef = useRef(null);
    const editCatSectionRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            const insideSubCat = editSubCatRef.current && editSubCatRef.current.contains(e.target);
            const insideCatSection = editCatSectionRef.current && editCatSectionRef.current.contains(e.target);
            if (!insideSubCat && !insideCatSection) setEditSubCatOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const editAvailableSubcats = editData.categories.length > 0
        ? productSubcategoryObjects.filter(s => s.categories?.some(c => editData.categories.includes(c)))
        : [];

    /* ── Fetch ── */
    const fetchList = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${url}/api/product/list`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) setList(res.data.data);
            else toast.error(res.data.message);
        } catch { toast.error('Error fetching products'); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchList(); }, []);

    /* ── Delete ── */
    const removeProduct = async (id) => {
        setIsLoading(true);
        try {
            const res = await axios.delete(`${url}/api/product/remove`, {
                data: { _id: id },
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) { toast.success('Product removed'); await fetchList(); }
            else toast.error(res.data.message || 'Failed to remove');
        } catch { toast.error('Error removing product'); }
        finally { setIsLoading(false); }
    };

    /* ── Edit helpers ── */
    const openEdit = (item) => {
        const cats = item.categories?.length ? item.categories : (item.category ? [item.category] : []);
        const materials = item.materials?.length ? item.materials : (item.material ? [item.material] : []);
        const finishes  = item.finishes?.length  ? item.finishes  : (item.finish   ? [item.finish]   : []);
        const subcats   = item.subcategories?.length ? item.subcategories : (item.subcategory ? [item.subcategory] : []);
        setEditData({
            _id:          item._id,
            name:         item.name          || '',
            description:  item.description   || '',
            categories:   cats,
            subcategories: subcats,
            materials,
            finishes,
            specialities: item.specialities  || [],
            applications: item.applications  || [],
            points:       item.points        || [],
            isFeatured:   item.isFeatured    || false,
        });
        setKeptImages(item.images || []);
        setEditImages([]);
        setIsEditOpen(true);
    };

    const onEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    };

    const toggleEditCategory = (cat) => {
        setEditData(prev => {
            const next = prev.categories.includes(cat)
                ? prev.categories.filter(c => c !== cat)
                : [...prev.categories, cat];
            const validSubNames = productSubcategoryObjects.filter(s => s.categories?.some(c => next.includes(c))).map(s => s.name);
            return {
                ...prev,
                categories: next,
                subcategories: prev.subcategories.filter(s => validSubNames.includes(s)),
            };
        });
    };

    const toggleEditChip = (field, val) => {
        setEditData(prev => ({
            ...prev,
            [field]: prev[field].includes(val)
                ? prev[field].filter(v => v !== val)
                : [...prev[field], val],
        }));
    };

    const onEditPointChange = (i, v) => { const pts = [...editData.points]; pts[i] = v; setEditData(p => ({ ...p, points: pts })); };
    const addEditPoint      = ()     => setEditData(p => ({ ...p, points: [...p.points, ''] }));
    const removeEditPoint   = (i)    => setEditData(p => ({ ...p, points: p.points.filter((_, idx) => idx !== i) }));
    const onEditImageChange = (e)    => setEditImages(p => [...p, ...Array.from(e.target.files)]);
    const removeEditImage   = (i)    => setEditImages(editImages.filter((_, idx) => idx !== i));
    const removeKeptImage   = (i)    => setKeptImages(keptImages.filter((_, idx) => idx !== i));

    const moveKeptImage = (index, direction) => {
        setKeptImages(prev => {
            const next = [...prev];
            const target = index + direction;
            if (target < 0 || target >= next.length) return prev;
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const moveEditImage = (index, direction) => {
        setEditImages(prev => {
            const next = [...prev];
            const target = index + direction;
            if (target < 0 || target >= next.length) return prev;
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    // Cloudinary: inserting fl_attachment forces a real download (with
    // correct headers) instead of the browser navigating to the image.
    const cloudinaryDownloadUrl = (imgUrl) => imgUrl.replace('/upload/', '/upload/fl_attachment/');

    const submitEdit = async (e) => {
        e.preventDefault();
        setIsEditOpen(false);
        setIsLoading(true);

        const fd = new FormData();
        fd.append('_id',          editData._id);
        fd.append('name',         editData.name);
        fd.append('description',  editData.description);
        fd.append('categories',   JSON.stringify(editData.categories));
        fd.append('subcategories', JSON.stringify(editData.subcategories));
        fd.append('materials',    JSON.stringify(editData.materials));
        fd.append('finishes',     JSON.stringify(editData.finishes));
        fd.append('specialities', JSON.stringify(editData.specialities));
        fd.append('applications', JSON.stringify(editData.applications));
        fd.append('points',       JSON.stringify(editData.points));
        fd.append('isFeatured',   editData.isFeatured);
        fd.append('existingImages', JSON.stringify(keptImages));
        editImages.forEach(img => fd.append('images', img));

        try {
            const res = await axios.post(`${url}/api/product/update`, fd, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) { toast.success('Product updated'); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error updating product'); }
        finally { setIsLoading(false); }
    };

    /* ── Filter ── */
    const filters     = ['All', ...productCategoryObjects.map(c => c.name)];
    const getCategories = (p) => p.categories?.length ? p.categories : (p.category ? [p.category] : []);
    const visibleList = list
        .filter(p => activeFilter === 'All' || getCategories(p).includes(activeFilter))
        .filter(p => !query || p.name.toLowerCase().includes(query.toLowerCase()));

    const totalPages    = Math.ceil(visibleList.length / ITEMS_PER_PAGE);
    const paginatedList = visibleList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    useEffect(() => { setCurrentPage(1); }, [activeFilter, query]);

    const getPageRange = (cur, total) => {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        if (cur <= 4)         return [1, 2, 3, 4, 5, '…', total];
        if (cur >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
        return [1, '…', cur - 1, cur, cur + 1, '…', total];
    };

    return (
        <div className="list add flex-col">

            {/* Lightbox */}
            {lightbox.open && ReactDOM.createPortal(
                <div className="lb-overlay" onClick={closeLightbox}>
                    <button className="lb-close" onClick={closeLightbox} aria-label="Close">✕</button>
                    {lightbox.images.length > 1 && <button className="lb-arrow lb-arrow--prev" onClick={lbPrev}>&#8249;</button>}
                    <div className="lb-img-wrap" onClick={e => e.stopPropagation()}>
                        <img src={lightbox.images[lightbox.index]} alt={lightbox.name} className="lb-img" />
                        <div className="lb-caption">
                            <span className="lb-name">{lightbox.name}</span>
                            {lightbox.images.length > 1 && <span className="lb-counter">{lightbox.index + 1} / {lightbox.images.length}</span>}
                        </div>
                    </div>
                    {lightbox.images.length > 1 && <button className="lb-arrow lb-arrow--next" onClick={lbNext}>&#8250;</button>}
                </div>,
                document.body
            )}

            {/* Edit modal */}
            {isEditOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Edit Product</h2>
                        <form className="flex-col" onSubmit={submitEdit}>

                            <div className="add-product-name flex-col">
                                <p>Product Name</p>
                                <input type="text" name="name" value={editData.name} onChange={onEditChange} required />
                            </div>

                            <div className="add-product-description flex-col">
                                <p>Description</p>
                                <textarea name="description" rows="4" value={editData.description} onChange={onEditChange} required />
                            </div>

                            {/* Categories (multi-select chips) */}
                            <div className="add-multi-section flex-col" ref={editCatSectionRef}>
                                <p>Categories <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#888' }}>(select all that apply)</span></p>
                                <div className="add-multi-grid">
                                    {productCategoryObjects.map(cat => {
                                        const sel = editData.categories.includes(cat.name);
                                        const iconUrl = iconifyImgUrl(cat.icon);
                                        return (
                                            <button key={cat._id} type="button"
                                                className={`add-multi-chip${sel ? ' active' : ''}`}
                                                style={sel ? { background: `${cat.color}22`, borderColor: `${cat.color}88`, color: cat.color } : {}}
                                                onClick={() => toggleEditCategory(cat.name)}>
                                                {iconUrl && <img src={sel ? `${iconUrl}?color=${encodeURIComponent(cat.color)}` : iconUrl} width={13} height={13} alt="" style={{ marginRight: '5px', verticalAlign: 'middle' }} />}
                                                {cat.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Subcategories — only shown when categories selected */}
                            {editAvailableSubcats.length > 0 && (
                                <div className="add-cat-dropdown-wrap flex-col">
                                    <p>Subcategories <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#888' }}>(select all that apply)</span></p>
                                    <div className="add-cat-dropdown" ref={editSubCatRef}>
                                        <button type="button" className={`add-cat-trigger${editSubCatOpen ? ' open' : ''}`} onClick={() => setEditSubCatOpen(o => !o)}>
                                            <span className={editData.subcategories.length > 0 ? '' : 'trigger-placeholder'}>{editData.subcategories.length > 0 ? editData.subcategories.join(', ') : 'Select subcategories'}</span>
                                            <i className="fa fa-chevron-down" />
                                        </button>
                                        {editSubCatOpen && (
                                            <ul className="add-cat-list">
                                                {editAvailableSubcats.map(sub => {
                                                    const iconUrl = iconifyImgUrl(sub.icon);
                                                    const sel = editData.subcategories.includes(sub.name);
                                                    return (
                                                        <li key={sub._id} className={`add-cat-option${sel ? ' active' : ''}`}
                                                            onClick={() => toggleEditChip('subcategories', sub.name)}>
                                                            {iconUrl && <img src={iconUrl} width={13} height={13} alt="" style={{ marginRight: '6px' }} />}
                                                            <span>{sub.name}</span>
                                                            {sel && <i className="fa fa-check" />}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Materials */}
                            <div className="add-multi-section flex-col">
                                <p>Materials</p>
                                <div className="add-multi-grid">
                                    {materialObjects.map(mat => {
                                        const sel = editData.materials.includes(mat.name);
                                        const iconUrl = iconifyImgUrl(mat.icon);
                                        return (
                                            <button key={mat._id} type="button"
                                                className={`add-multi-chip${sel ? ' active' : ''}`}
                                                style={sel ? { background: `${mat.color}22`, borderColor: `${mat.color}88`, color: mat.color } : {}}
                                                onClick={() => toggleEditChip('materials', mat.name)}>
                                                {iconUrl && <img src={sel ? `${iconUrl}?color=${encodeURIComponent(mat.color)}` : iconUrl} width={13} height={13} alt="" style={{ marginRight: '5px', verticalAlign: 'middle' }} />}
                                                {mat.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Finishes */}
                            <div className="add-multi-section flex-col">
                                <p>Finishes</p>
                                <div className="add-multi-grid">
                                    {finishObjects.map(fin => {
                                        const sel = editData.finishes.includes(fin.name);
                                        const iconUrl = iconifyImgUrl(fin.icon);
                                        return (
                                            <button key={fin._id} type="button"
                                                className={`add-multi-chip${sel ? ' active' : ''}`}
                                                style={sel ? { background: `${fin.color}22`, borderColor: `${fin.color}88`, color: fin.color } : {}}
                                                onClick={() => toggleEditChip('finishes', fin.name)}>
                                                {iconUrl && <img src={sel ? `${iconUrl}?color=${encodeURIComponent(fin.color)}` : iconUrl} width={13} height={13} alt="" style={{ marginRight: '5px', verticalAlign: 'middle' }} />}
                                                {fin.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Specialities */}
                            <div className="add-multi-section flex-col">
                                <p>Specialities</p>
                                <div className="add-multi-grid">
                                    {specialityObjects.map(spec => {
                                        const sel = editData.specialities.includes(spec.name);
                                        const iconUrl = iconifyImgUrl(spec.icon);
                                        return (
                                            <button key={spec._id} type="button"
                                                className={`add-multi-chip${sel ? ' active' : ''}`}
                                                style={sel ? { background: `${spec.color}22`, borderColor: `${spec.color}88`, color: spec.color } : {}}
                                                onClick={() => toggleEditChip('specialities', spec.name)}>
                                                {iconUrl && <img src={sel ? `${iconUrl}?color=${encodeURIComponent(spec.color)}` : iconUrl} width={13} height={13} alt="" style={{ marginRight: '5px', verticalAlign: 'middle' }} />}
                                                {spec.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Applications */}
                            <div className="add-multi-section flex-col">
                                <p>Applications</p>
                                <div className="add-multi-grid">
                                    {applicationObjects.map(app => {
                                        const sel = editData.applications.includes(app.name);
                                        const color = '#c9a87c'; // golden theme — same for every application badge
                                        const iconUrl = iconifyImgUrl(app.icon);
                                        return (
                                            <button key={app._id} type="button"
                                                className={`add-multi-chip${sel ? ' active' : ''}`}
                                                style={sel ? { background: `${color}22`, borderColor: `${color}88`, color } : {}}
                                                onClick={() => toggleEditChip('applications', app.name)}>
                                                {iconUrl && <img src={sel ? `${iconUrl}?color=${encodeURIComponent(color)}` : iconUrl} width={13} height={13} alt="" style={{ marginRight: '5px', verticalAlign: 'middle' }} />}
                                                {app.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Points */}
                            <div className="add-product-points flex-col">
                                <p>Key Highlights</p>
                                {editData.points.map((pt, i) => (
                                    <div key={i} className="point-input">
                                        <input type="text" value={pt} onChange={e => onEditPointChange(i, e.target.value)} />
                                        <button type="button" onClick={() => removeEditPoint(i)} className="remove-point-btn">X</button>
                                    </div>
                                ))}
                                <button type="button" className="add-point-btn" onClick={addEditPoint}>+ Add Highlight</button>
                            </div>

                            {/* Featured */}
                            <div className="add-featured flex-col" style={{ marginTop: '8px' }}>
                                <label className="featured-toggle">
                                    <input type="checkbox" name="isFeatured" checked={editData.isFeatured} onChange={onEditChange} />
                                    <span className="toggle-slider" />
                                    <span className="toggle-label">Feature on Products Page</span>
                                </label>
                            </div>

                            {/* Images */}
                            <div className="add-img-upload flex-col" style={{ marginTop: '8px' }}>
                                <p>Images — number shows display order on the site</p>
                                <div className="selected-images" style={{ marginBottom: '10px' }}>
                                    {keptImages.map((u, i) => (
                                        <div key={`kept-${i}`} className="image-preview" style={{ alignItems: 'center', gap: '8px' }}>
                                            <span style={imgOrderBadgeStyle}>{i + 1}</span>
                                            <img src={u} alt={`existing-${i}`} className="thumbnail" />
                                            <button type="button" onClick={() => removeKeptImage(i)} className="remove-btn">X</button>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <button type="button" style={imgToolBtnStyle(i === 0)} disabled={i === 0}
                                                    onClick={() => moveKeptImage(i, -1)} title="Move earlier">
                                                    <ChevronIcon dir="left" />
                                                </button>
                                                <a style={imgToolBtnStyle(false)} href={cloudinaryDownloadUrl(u)} target="_blank" rel="noopener noreferrer" title="Download image">
                                                    <DownloadIcon />
                                                </a>
                                                <button type="button" style={imgToolBtnStyle(i === keptImages.length - 1)} disabled={i === keptImages.length - 1}
                                                    onClick={() => moveKeptImage(i, 1)} title="Move later">
                                                    <ChevronIcon dir="right" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {editImages.map((img, i) => (
                                        <div key={`new-${i}`} className="image-preview" style={{ alignItems: 'center', gap: '8px' }}>
                                            <span style={imgOrderBadgeStyle}>{keptImages.length + i + 1}</span>
                                            <img src={URL.createObjectURL(img)} alt={`new-${i}`} className="thumbnail" />
                                            <button type="button" onClick={() => removeEditImage(i)} className="remove-btn">X</button>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <button type="button" style={imgToolBtnStyle(i === 0)} disabled={i === 0}
                                                    onClick={() => moveEditImage(i, -1)} title="Move earlier">
                                                    <ChevronIcon dir="left" />
                                                </button>
                                                <a style={imgToolBtnStyle(false)} href={URL.createObjectURL(img)} download={img.name} title="Download image">
                                                    <DownloadIcon />
                                                </a>
                                                <button type="button" style={imgToolBtnStyle(i === editImages.length - 1)} disabled={i === editImages.length - 1}
                                                    onClick={() => moveEditImage(i, 1)} title="Move later">
                                                    <ChevronIcon dir="right" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <label htmlFor="edit-prod-img" className="upload-icon">
                                    <i className="fa fa-upload" style={{ fontSize: '24px', width: '60px', height: '60px' }} />
                                </label>
                                <input type="file" id="edit-prod-img" multiple hidden onChange={onEditImageChange} />
                            </div>

                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={() => setIsEditOpen(false)}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={isLoading}>{isLoading ? 'Saving…' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Page */}
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <h1>Manage Products</h1>
                        <p className="admin-subtitle">Browse and manage all product catalogue entries.</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div className="admin-search-wrap">
                            <i className="fa-solid fa-magnifying-glass" />
                            <input
                                type="text"
                                placeholder="Search by name…"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                            {query && <button className="admin-search-clear" onClick={() => setQuery('')}>×</button>}
                        </div>
                        <div className="admin-count-badge">{visibleList.length} found</div>
                    </div>
                </div>

                {/* Filter pills */}
                <div className="admin-category-scroll" ref={mobileBarRef}>
                    {filters.map(f => (
                        <button key={f} className={`admin-cat-pill${activeFilter === f ? ' active' : ''}`} onClick={() => setActiveFilter(f)}>
                            {f}{f !== 'All' && ` (${list.filter(p => getCategories(p).includes(f)).length})`}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="list-table">
                    <div className="list-table-format title">
                        <b>Image</b>
                        <b>Product</b>
                        <b>Category</b>
                        <b>Action</b>
                    </div>
                    {visibleList.length === 0 ? (
                        <div className="admin-empty-state">No products found.</div>
                    ) : (
                        paginatedList.map((item, i) => (
                            <div key={i} className="list-table-format row-item">
                                <div className="image-column">
                                    {item.images && item.images.length > 0 ? (
                                        <img src={item.images[0]} alt="thumbnail" className="lb-trigger"
                                            onClick={() => openLightbox(item.images, 0, item.name)} title="Click to view" />
                                    ) : <div className="placeholder-img" />}
                                </div>
                                <div>
                                    <p className="item-name">{item.name}</p>
                                    {(item.subcategories?.length ? item.subcategories : (item.subcategory ? [item.subcategory] : [])).length > 0 && (
                                        <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-mid)', margin: '4px 0 0' }}>
                                            {(item.subcategories?.length ? item.subcategories : [item.subcategory]).join(', ')}
                                        </p>
                                    )}
                                </div>
                                <p className="item-category">{getCategories(item).join(', ') || '—'}</p>
                                <div className="action-buttons">
                                    <p onClick={() => openEdit(item)} className="cursor edit-action">Edit</p>
                                    <p onClick={() => removeProduct(item._id)} className="cursor delete-action">X</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="admin-pagination">
                        <button className="admin-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                        {getPageRange(currentPage, totalPages).map((p, i) =>
                            p === '…'
                                ? <span key={`e${i}`} className="admin-page-ellipsis">…</span>
                                : <button key={p} className={`admin-page-btn${p === currentPage ? ' active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
                        )}
                        <button className="admin-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ListProducts;
