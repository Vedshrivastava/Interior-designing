import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import '../styles/list.css';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
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

const ListProducts = ({ url, setIsLoading, isLoading }) => {
    const [list,         setList]         = useState([]);
    const [activeFilter, setActiveFilter] = useState('All');
    const [query, setQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;
    const mobileBarRef = useRef(null);
    const token = localStorage.getItem('token');

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
        subcategory: '', material: '', finish: '',
        specialities: [], applications: [], points: [], isFeatured: false,
    };
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editData,   setEditData]   = useState(blankEdit);
    const [keptImages, setKeptImages] = useState([]);
    const [editImages, setEditImages] = useState([]);

    const [editSubCatOpen, setEditSubCatOpen] = useState(false);
    const editSubCatRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (editSubCatRef.current && !editSubCatRef.current.contains(e.target)) setEditSubCatOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const editAvailableSubcats = editData.categories.length > 0
        ? [...new Set(editData.categories.flatMap(cat => SUBCATEGORIES[cat] || []))]
        : [];

    /* ── Fetch ── */
    const fetchList = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${url}/api/product/list`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) setList([...res.data.data].reverse());
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
        setEditData({
            _id:          item._id,
            name:         item.name          || '',
            description:  item.description   || '',
            categories:   cats,
            subcategory:  item.subcategory   || '',
            material:     item.material      || '',
            finish:       item.finish        || '',
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
            const nextSubcats = [...new Set(next.flatMap(c => SUBCATEGORIES[c] || []))];
            return {
                ...prev,
                categories: next,
                subcategory: nextSubcats.includes(prev.subcategory) ? prev.subcategory : (nextSubcats[0] || ''),
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

    const submitEdit = async (e) => {
        e.preventDefault();
        setIsEditOpen(false);
        setIsLoading(true);

        const fd = new FormData();
        fd.append('_id',          editData._id);
        fd.append('name',         editData.name);
        fd.append('description',  editData.description);
        fd.append('categories',   JSON.stringify(editData.categories));
        fd.append('subcategory',  editData.subcategory);
        fd.append('material',     editData.material);
        fd.append('finish',       editData.finish);
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
    const filters     = ['All', ...CATEGORIES];
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
                            <div className="add-multi-section flex-col">
                                <p>Categories <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#888' }}>(select all that apply)</span></p>
                                <div className="add-multi-grid">
                                    {CATEGORIES.map(cat => (
                                        <button key={cat} type="button"
                                            className={`add-multi-chip${editData.categories.includes(cat) ? ' active' : ''}`}
                                            onClick={() => toggleEditCategory(cat)}>
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Subcategory — only shown when categories selected */}
                            {editAvailableSubcats.length > 0 && (
                                <div className="add-cat-dropdown-wrap flex-col">
                                    <p>Subcategory</p>
                                    <div className="add-cat-dropdown" ref={editSubCatRef}>
                                        <button type="button" className={`add-cat-trigger${editSubCatOpen ? ' open' : ''}`} onClick={() => setEditSubCatOpen(o => !o)}>
                                            <span>{editData.subcategory || 'Select subcategory'}</span>
                                            <i className="fa fa-chevron-down" />
                                        </button>
                                        {editSubCatOpen && (
                                            <ul className="add-cat-list">
                                                {editAvailableSubcats.map((sub, i) => (
                                                    <li key={i} className={`add-cat-option${editData.subcategory === sub ? ' active' : ''}`}
                                                        onClick={() => { setEditData(prev => ({ ...prev, subcategory: sub })); setEditSubCatOpen(false); }}>
                                                        <span>{sub}</span>
                                                        {editData.subcategory === sub && <i className="fa fa-check" />}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Material + Finish */}
                            <div className="add-category-price">
                                <div className="flex-col" style={{ flex: 1 }}>
                                    <p>Material</p>
                                    <input type="text" name="material" value={editData.material} onChange={onEditChange} placeholder="e.g. Concrete" />
                                </div>
                                <div className="flex-col" style={{ flex: 1 }}>
                                    <p>Finish</p>
                                    <input type="text" name="finish" value={editData.finish} onChange={onEditChange} placeholder="e.g. Matte" />
                                </div>
                            </div>

                            {/* Specialities */}
                            <div className="add-multi-section flex-col">
                                <p>Specialities</p>
                                <div className="add-multi-grid">
                                    {SPECIALITIES.map(spec => (
                                        <button key={spec} type="button"
                                            className={`add-multi-chip${editData.specialities.includes(spec) ? ' active' : ''}`}
                                            onClick={() => toggleEditChip('specialities', spec)}>
                                            {spec}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Applications */}
                            <div className="add-multi-section flex-col">
                                <p>Applications</p>
                                <div className="add-multi-grid">
                                    {APPLICATIONS.map(app => (
                                        <button key={app} type="button"
                                            className={`add-multi-chip${editData.applications.includes(app) ? ' active' : ''}`}
                                            onClick={() => toggleEditChip('applications', app)}>
                                            {app}
                                        </button>
                                    ))}
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
                                <p>Images</p>
                                <div className="selected-images" style={{ marginBottom: '10px' }}>
                                    {keptImages.map((u, i) => (
                                        <div key={`kept-${i}`} className="image-preview">
                                            <img src={u} alt={`existing-${i}`} className="thumbnail" />
                                            <button type="button" onClick={() => removeKeptImage(i)} className="remove-btn">X</button>
                                        </div>
                                    ))}
                                    {editImages.map((img, i) => (
                                        <div key={`new-${i}`} className="image-preview">
                                            <img src={URL.createObjectURL(img)} alt={`new-${i}`} className="thumbnail" />
                                            <button type="button" onClick={() => removeEditImage(i)} className="remove-btn">X</button>
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
                                    {item.subcategory && (
                                        <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-mid)', margin: '4px 0 0' }}>
                                            {item.subcategory}
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
