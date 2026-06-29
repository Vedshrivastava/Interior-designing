import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import '../styles/list.css';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useWebSocket } from '../hooks/useWebSocket';

const CITY_OPTIONS = [
    { slug: 'satna',    label: 'Satna'    },
    { slug: 'nagod',    label: 'Nagod'    },
    { slug: 'indore',   label: 'Indore'   },
    { slug: 'bhopal',   label: 'Bhopal'   },
    { slug: 'jabalpur', label: 'Jabalpur' },
    { slug: 'rewa',     label: 'Rewa'     },
    { slug: 'mumbai',   label: 'Mumbai'   },
    { slug: 'pune',     label: 'Pune'     },
];

const FALLBACK_CATEGORIES = ['Full Home Interior','Kitchen','Bedroom','Living Room','Bathroom','TV Unit','Kids Room','Commercial','Office','Villa / Bungalow','Apartment','Renovation'];
const FALLBACK_TYPES      = ['Residential','Commercial'];

const toDateInput = (dateStr) => {
    if (!dateStr) return '';
    try { return new Date(dateStr).toISOString().split('T')[0]; } catch { return ''; }
};

const ListProjects = ({ url, setIsLoading, isLoading }) => {
    const [list,          setList]          = useState([]);
    const [activeFilter,    setActiveFilter]    = useState('All');
    const [projectCategories, setProjectCategories] = useState(FALLBACK_CATEGORIES);
    const [projectTypes,      setProjectTypes]      = useState(FALLBACK_TYPES);

    useEffect(() => {
        axios.get(`${url}/api/project-category/list`).then(r => { if (r.data.success) setProjectCategories(r.data.data.map(c => c.name)); }).catch(() => {});
        axios.get(`${url}/api/project-type/list`).then(r => { if (r.data.success) setProjectTypes(r.data.data.map(t => t.name)); }).catch(() => {});
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
        _id: '', name: '', description: '', category: projectCategories[0] || '',
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

    useWebSocket(useCallback((msg) => {
        if (msg.type === 'projectsChanged')          fetchList();
        if (msg.type === 'projectTypesChanged')      fetchProjectTypes_();
        if (msg.type === 'projectCategoriesChanged') fetchProjectCategories_();
    }, [fetchProjectTypes_, fetchProjectCategories_]));

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
            category:          item.category          || projectCategories[0] || '',
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

    const submitEdit = async (e) => {
        e.preventDefault();
        setIsEditOpen(false);
        setIsLoading(true);

        const fd = new FormData();
        fd.append('_id',               editData._id);
        fd.append('name',              editData.name);
        fd.append('description',       editData.description);
        fd.append('category',          editData.category);
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

                            <div className="add-category-price">
                                <div className="flex-col" style={{ flex: 1 }}>
                                    <p>Category</p>
                                    <select name="category" value={editData.category} onChange={onEditChange}>
                                        {projectCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
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
                                            <span>{editData.cityPage ? CITY_OPTIONS.find(c => c.slug === editData.cityPage)?.label : '— Pick a city —'}</span>
                                            <i className="fa fa-chevron-down" />
                                        </button>
                                        {editCityOpen && (
                                            <ul className="add-cat-list">
                                                {CITY_OPTIONS.map(c => (
                                                    <li
                                                        key={c.slug}
                                                        className={`add-cat-option${editData.cityPage === c.slug ? ' active' : ''}`}
                                                        onClick={() => {
                                                            setEditData(p => ({ ...p, cityPage: c.slug }));
                                                            setEditCityOpen(false);
                                                        }}
                                                    >
                                                        <span>{c.label}</span>
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
                                <p>Images</p>
                                <div className="selected-images" style={{ marginBottom: '10px' }}>
                                    {keptImages.map((url, i) => (
                                        <div key={`kept-${i}`} className="image-preview">
                                            <img src={url} alt={`existing-${i}`} className="thumbnail" />
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
                        {CITY_OPTIONS.map(c => (
                            <button
                                key={c.slug}
                                className={`admin-cat-pill${cityFilter === c.slug ? ' active' : ''}`}
                                onClick={() => setCityFilter(c.slug)}
                            >
                                {c.label}
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
                                            {CITY_OPTIONS.find(c => c.slug === item.cityPage)?.label || item.cityPage} city page
                                        </p>
                                    )}
                                </div>

                                <p className="item-category">{item.projectType}</p>

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
