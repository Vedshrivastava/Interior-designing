import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import '../styles/list.css';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useWebSocket } from '../hooks/useWebSocket';

const FALLBACK_CATEGORIES = ['Full Home Interior','Kitchen','Bedroom','Living Room','Bathroom','TV Unit','Kids Room','Commercial','Office','Villa / Bungalow','Apartment','Renovation'];
const FALLBACK_TYPES      = ['Residential','Commercial'];

const toDateInput = (dateStr) => {
    if (!dateStr) return '';
    try { return new Date(dateStr).toISOString().split('T')[0]; } catch { return ''; }
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

const ListProjects = ({ url, setIsLoading, isLoading }) => {
    const [list,          setList]          = useState([]);
    const [activeFilter,    setActiveFilter]    = useState('All');
    const [projectCategories, setProjectCategories] = useState(FALLBACK_CATEGORIES);
    const [projectTypes,      setProjectTypes]      = useState(FALLBACK_TYPES);

    const [cityObjects, setCityObjects] = useState([]);

    useEffect(() => {
        axios.get(`${url}/api/project-category/list`).then(r => { if (r.data.success) setProjectCategories(r.data.data.map(c => c.name)); }).catch(() => {});
        axios.get(`${url}/api/project-type/list`).then(r => { if (r.data.success) setProjectTypes(r.data.data.map(t => t.name)); }).catch(() => {});
        axios.get(`${url}/api/city/list`).then(r => { if (r.data.success) setCityObjects(r.data.data); }).catch(() => {});
    }, [url]);
    const [cityMode,      setCityMode]      = useState(false);
    const [cityFilter,    setCityFilter]    = useState('');
    const [editCityOpen,  setEditCityOpen]  = useState(false);
    const mobileBarRef = useRef(null);
    const editCityRef  = useRef(null);
    const token = localStorage.getItem('token');

    /* ── Lightbox ── */
    const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0, name: '' });

    const openLightbox  = (images, index, name) => { setLightbox({ open: true, images, index, name }); document.body.style.overflow = 'hidden'; };
    const closeLightbox = useCallback(() => { setLightbox({ open: false, images: [], index: 0, name: '' }); document.body.style.overflow = ''; }, []);
    const lbPrev        = useCallback((e) => { e.stopPropagation(); setLightbox(p => ({ ...p, index: (p.index - 1 + p.images.length) % p.images.length })); }, []);
    const lbNext        = useCallback((e) => { e.stopPropagation(); setLightbox(p => ({ ...p, index: (p.index + 1) % p.images.length })); }, []);

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
        _id: '', name: '', description: '', categories: [], category: '',
        projectType: projectTypes[0] || '', location: '', area: '', duration: '',
        completedAt: '', clientTestimonial: '', isFeatured: false, points: [],
        showInCityPage: false, cityPage: '',
    };
    const [isEditOpen,  setIsEditOpen]  = useState(false);
    const [editData,    setEditData]    = useState(blankEdit);
    const [keptImages,  setKeptImages]  = useState([]);
    const [editImages,  setEditImages]  = useState([]);

    /* ── Data fetching ── */
    const fetchList = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${url}/api/project/list`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) setList(res.data.data);
            else toast.error(res.data.message);
        } catch {
            toast.error('Error fetching projects');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchList(); }, []);

    const fetchProjectTypes_ = useCallback(() => {
        axios.get(`${url}/api/project-type/list`).then(r => { if (r.data.success) setProjectTypes(r.data.data.map(t => t.name)); }).catch(() => {});
    }, [url]);

    const fetchProjectCategories_ = useCallback(() => {
        axios.get(`${url}/api/project-category/list`).then(r => { if (r.data.success) setProjectCategories(r.data.data.map(c => c.name)); }).catch(() => {});
    }, [url]);

    const fetchCities_ = useCallback(() => {
        axios.get(`${url}/api/city/list`).then(r => { if (r.data.success) setCityObjects(r.data.data); }).catch(() => {});
    }, [url]);

    useWebSocket(useCallback((msg) => {
        if (msg.type === 'projectsChanged')          fetchList();
        if (msg.type === 'projectTypesChanged')      fetchProjectTypes_();
        if (msg.type === 'projectCategoriesChanged') fetchProjectCategories_();
        if (msg.type === 'citiesChanged')            fetchCities_();
    }, [fetchProjectTypes_, fetchProjectCategories_, fetchCities_]));

    /* ── Delete ── */
    const removeProject = async (id) => {
        setIsLoading(true);
        try {
            const res = await axios.delete(`${url}/api/project/remove`, {
                data: { _id: id },
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) { toast.success('Project removed'); await fetchList(); }
            else toast.error(res.data.message || 'Failed to remove');
        } catch {
            toast.error('Error removing project');
        } finally {
            setIsLoading(false);
        }
    };

    /* ── Edit helpers ── */
    const openEdit = (item) => {
        setEditData({
            _id:               item._id,
            name:              item.name              || '',
            description:       item.description       || '',
            categories:        item.categories?.length > 0 ? item.categories : (item.category ? [item.category] : []),
            category:          item.category          || '',
            projectType:       item.projectType       || projectTypes[0]     || '',
            location:          item.location          || '',
            area:              item.area              || '',
            duration:          item.duration          || '',
            completedAt:       toDateInput(item.completedAt),
            clientTestimonial: item.clientTestimonial || '',
            isFeatured:        item.isFeatured        || false,
            points:            item.points            || [],
            showInCityPage:    !!item.cityPage,
            cityPage:          item.cityPage          || '',
        });
        setKeptImages(item.images || []);
        setEditImages([]);
        setIsEditOpen(true);
    };

    const onEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
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
        fd.append('_id',               editData._id);
        fd.append('name',              editData.name);
        fd.append('description',       editData.description);
        fd.append('categories',        JSON.stringify(editData.categories || []));
        fd.append('projectType',       editData.projectType);
        fd.append('location',          editData.location);
        fd.append('area',              editData.area);
        fd.append('duration',          editData.duration);
        fd.append('completedAt',       editData.completedAt);
        fd.append('clientTestimonial', editData.clientTestimonial);
        fd.append('isFeatured',        editData.isFeatured);
        fd.append('cityPage',          editData.showInCityPage ? editData.cityPage : '');
        fd.append('points',            JSON.stringify(editData.points));
        fd.append('existingImages',    JSON.stringify(keptImages));
        editImages.forEach(img => fd.append('images', img));

        try {
            const res = await axios.post(`${url}/api/project/update`, fd, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) { toast.success('Project updated'); await fetchList(); }
            else toast.error(res.data.message);
        } catch {
            toast.error('Error updating project');
        } finally {
            setIsLoading(false);
        }
    };

    /* ── Filter ── */
    const filters = ['All', ...projectTypes];
    const visibleList = cityMode
        ? list.filter(p => p.cityPage && (cityFilter === '' || p.cityPage === cityFilter))
        : (activeFilter === 'All' ? list : list.filter(p => p.projectType === activeFilter));

    return (
        <div className="list add flex-col">

            {/* ── Lightbox ── */}
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

            {/* ── Edit modal ── */}
            {isEditOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Edit Project</h2>
                        <form className="flex-col" onSubmit={submitEdit}>

                            <div className="add-product-name flex-col">
                                <p>Project Name</p>
                                <input type="text" name="name" value={editData.name} onChange={onEditChange} required />
                            </div>

                            <div className="add-product-description flex-col">
                                <p>Description</p>
                                <textarea name="description" rows="4" value={editData.description} onChange={onEditChange} required />
                            </div>

                            <div className="add-category-price" style={{ alignItems: 'flex-start' }}>
                                <div className="flex-col" style={{ flex: 1 }}>
                                    <p>Categories <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-lt)' }}>(select all that apply)</span></p>
                                    {editData.categories?.length > 0 && (
                                        <div className="proj-cat-chips" style={{ marginBottom: '8px' }}>
                                            {editData.categories.map(c => (
                                                <span key={c} className="proj-cat-chip">
                                                    {c}
                                                    <button type="button" onClick={() => setEditData(p => ({ ...p, categories: p.categories.filter(x => x !== c) }))}>×</button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid rgba(201,168,124,0.2)', borderRadius: '8px', padding: '6px' }}>
                                        {projectCategories.map(c => {
                                            const checked = editData.categories?.includes(c);
                                            return (
                                                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', background: checked ? 'rgba(16,37,37,0.06)' : 'none', fontFamily: '"DM Sans", sans-serif', fontSize: '0.82rem', color: 'var(--green)' }}>
                                                    <input type="checkbox" checked={checked} onChange={() => setEditData(p => ({ ...p, categories: checked ? p.categories.filter(x => x !== c) : [...(p.categories || []), c] }))} />
                                                    {c}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex-col" style={{ flex: 1 }}>
                                    <p>Project Type</p>
                                    <select name="projectType" value={editData.projectType} onChange={onEditChange}>
                                        {projectTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="add-product-name flex-col">
                                <p>Location</p>
                                <input type="text" name="location" value={editData.location} onChange={onEditChange} required />
                            </div>

                            <div className="add-category-price">
                                <div className="flex-col" style={{ flex: 1 }}>
                                    <p>Area</p>
                                    <input type="text" name="area" value={editData.area} onChange={onEditChange} placeholder="e.g. 1500 sq.ft" />
                                </div>
                                <div className="flex-col" style={{ flex: 1 }}>
                                    <p>Duration</p>
                                    <input type="text" name="duration" value={editData.duration} onChange={onEditChange} placeholder="e.g. 8 weeks" />
                                </div>
                            </div>

                            <div className="add-category-price">
                                <div className="flex-col" style={{ flex: 1 }}>
                                    <p>Completion Date</p>
                                    <input type="date" name="completedAt" value={editData.completedAt} onChange={onEditChange} />
                                </div>
                                <div className="add-featured flex-col" style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: '2px' }}>
                                    <label className="featured-toggle">
                                        <input type="checkbox" name="isFeatured" checked={editData.isFeatured} onChange={onEditChange} />
                                        <span className="toggle-slider" />
                                        <span className="toggle-label">Feature on Projects Page</span>
                                    </label>
                                </div>
                            </div>

                            <label className={`add-feature-card${editData.showInCityPage ? ' active' : ''}`} style={{ cursor: 'pointer' }}>
                                <div className="add-feature-left">
                                    <div className="add-feature-icon"><i className="fa fa-location-dot" /></div>
                                    <div className="add-feature-text">
                                        <span className="add-feature-title">Show on a City Page</span>
                                        <span className="add-feature-desc">This project will also appear on the selected city's page.</span>
                                    </div>
                                </div>
                                <input type="checkbox" name="showInCityPage" checked={editData.showInCityPage} onChange={onEditChange} style={{ display: 'none' }} />
                                <span className="toggle-slider" />
                            </label>
                            {editData.showInCityPage && (
                                <div className="add-cat-dropdown-wrap flex-col" style={{ marginTop: '8px' }} ref={editCityRef}>
                                    <p>Select City</p>
                                    <div className="add-cat-dropdown">
                                        <button
                                            type="button"
                                            className={`add-cat-trigger${editCityOpen ? ' open' : ''}`}
                                            onClick={() => setEditCityOpen(o => !o)}
                                        >
                                            <span>{editData.cityPage ? (cityObjects.find(c => c.slug === editData.cityPage)?.name || editData.cityPage) : '— Pick a city —'}</span>
                                            <i className="fa fa-chevron-down" />
                                        </button>
                                        {editCityOpen && (
                                            <ul className="add-cat-list">
                                                {cityObjects.map(c => (
                                                    <li
                                                        key={c._id}
                                                        className={`add-cat-option${editData.cityPage === c.slug ? ' active' : ''}`}
                                                        onClick={() => {
                                                            setEditData(p => ({ ...p, cityPage: c.slug }));
                                                            setEditCityOpen(false);
                                                        }}
                                                    >
                                                        <span>{c.name}, {c.state}</span>
                                                        {editData.cityPage === c.slug && <i className="fa fa-check" />}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}

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

                            <div className="add-product-description flex-col">
                                <p>Client Testimonial</p>
                                <textarea name="clientTestimonial" rows="3" value={editData.clientTestimonial} onChange={onEditChange} placeholder="Optional client quote…" />
                            </div>

                            <div className="add-img-upload flex-col" style={{ marginTop: '8px' }}>
                                <p>Images — number shows display order on the site</p>
                                <div className="selected-images" style={{ marginBottom: '10px' }}>
                                    {keptImages.map((url, i) => (
                                        <div key={`kept-${i}`} className="image-preview" style={{ alignItems: 'center', gap: '8px' }}>
                                            <span style={imgOrderBadgeStyle}>{i + 1}</span>
                                            <img src={url} alt={`existing-${i}`} className="thumbnail" />
                                            <button type="button" onClick={() => removeKeptImage(i)} className="remove-btn">X</button>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <button type="button" style={imgToolBtnStyle(i === 0)} disabled={i === 0}
                                                    onClick={() => moveKeptImage(i, -1)} title="Move earlier">
                                                    <ChevronIcon dir="left" />
                                                </button>
                                                <a style={imgToolBtnStyle(false)} href={cloudinaryDownloadUrl(url)} target="_blank" rel="noopener noreferrer" title="Download image">
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
                                <label htmlFor="edit-proj-img" className="upload-icon">
                                    <i className="fa fa-upload" style={{ fontSize: '24px', width: '60px', height: '60px' }} />
                                </label>
                                <input type="file" id="edit-proj-img" multiple hidden onChange={onEditImageChange} />
                            </div>

                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={() => setIsEditOpen(false)}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={isLoading}>
                                    {isLoading ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Page content ── */}
            <div className="admin-list-container">

                <div className="admin-header-split">
                    <div>
                        <h1>Manage Projects</h1>
                        <p className="admin-subtitle">Curate the portfolio shown to visitors.</p>
                    </div>
                    <div className="admin-count-badge">{visibleList.length} projects</div>
                </div>

                {/* City mode toggle */}
                <label className={`add-feature-card${cityMode ? ' active' : ''}`} style={{ marginBottom: '12px', cursor: 'pointer' }}>
                    <div className="add-feature-left">
                        <div className="add-feature-icon"><i className="fa fa-location-dot" /></div>
                        <div className="add-feature-text">
                            <span className="add-feature-title">City Projects</span>
                            <span className="add-feature-desc">Show only projects assigned to a city page.</span>
                        </div>
                    </div>
                    <input type="checkbox" checked={cityMode} onChange={e => { setCityMode(e.target.checked); setCityFilter(''); }} style={{ display: 'none' }} />
                    <span className="toggle-slider" />
                </label>

                {/* Filter pills / city dropdown */}
                {cityMode ? (
                    <div className="admin-category-scroll" ref={mobileBarRef}>
                        <button
                            className={`admin-cat-pill${cityFilter === '' ? ' active' : ''}`}
                            onClick={() => setCityFilter('')}
                        >
                            All Cities
                        </button>
                        {cityObjects.map(c => (
                            <button
                                key={c._id}
                                className={`admin-cat-pill${cityFilter === c.slug ? ' active' : ''}`}
                                onClick={() => setCityFilter(c.slug)}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="admin-category-scroll" ref={mobileBarRef}>
                        {filters.map(f => (
                            <button
                                key={f}
                                className={`admin-cat-pill${activeFilter === f ? ' active' : ''}`}
                                onClick={() => setActiveFilter(f)}
                            >
                                {f}
                                {f !== 'All' && ` (${list.filter(p => p.projectType === f).length})`}
                            </button>
                        ))}
                    </div>
                )}

                {/* Table */}
                <div className="list-table">
                    <div className="list-table-format title">
                        <b>Image</b>
                        <b>Project</b>
                        <b>Type</b>
                        <b>Action</b>
                    </div>

                    {visibleList.length === 0 ? (
                        <div className="admin-empty-state">No projects found.</div>
                    ) : (
                        visibleList.map((item, i) => (
                            <div key={i} className="list-table-format row-item">
                                <div className="image-column">
                                    {item.images && item.images.length > 0 ? (
                                        <img
                                            src={item.images[0]}
                                            alt="thumbnail"
                                            className="lb-trigger"
                                            onClick={() => openLightbox(item.images, 0, item.name)}
                                            title="Click to view images"
                                        />
                                    ) : (
                                        <div className="placeholder-img" />
                                    )}
                                </div>

                                <div>
                                    <p className="item-name">{item.name}</p>
                                    {item.location && (
                                        <p style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '0.78rem', color: 'var(--text-mid)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <i className="fa fa-location-dot" style={{ color: 'var(--gold)', fontSize: '0.7rem' }} />
                                            {item.location}
                                        </p>
                                    )}
                                    {item.completedAt && (
                                        <p style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '0.72rem', color: 'var(--text-lt)', margin: '2px 0 0' }}>
                                            {moment(item.completedAt).format('MMMM YYYY')}
                                        </p>
                                    )}
                                    {item.cityPage && (
                                        <p style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '0.7rem', color: 'var(--color-accent)', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <i className="fa fa-location-dot" style={{ fontSize: '0.65rem' }} />
                                            {cityObjects.find(c => c.slug === item.cityPage)?.name || item.cityPage} city page
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <p className="item-category" style={{ marginBottom: '4px' }}>{item.projectType}</p>
                                    {(item.categories?.length > 0 ? item.categories : item.category ? [item.category] : []).map(c => (
                                        <span key={c} style={{ display: 'inline-block', fontSize: '0.68rem', fontFamily: '"DM Sans",sans-serif', background: 'rgba(201,168,124,0.1)', border: '1px solid rgba(201,168,124,0.25)', borderRadius: '999px', padding: '1px 8px', marginRight: '4px', marginBottom: '2px', color: 'var(--text-mid)' }}>{c}</span>
                                    ))}
                                </div>

                                <div className="action-buttons">
                                    <p onClick={() => openEdit(item)} className="cursor edit-action">Edit</p>
                                    <p onClick={() => removeProject(item._id)} className="cursor delete-action">X</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ListProjects;
