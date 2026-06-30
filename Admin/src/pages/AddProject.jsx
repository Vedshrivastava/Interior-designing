import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const CITY_OPTIONS = [
    { slug: 'satna',    label: 'Satna, MP'    },
    { slug: 'nagod',    label: 'Nagod, MP'    },
    { slug: 'indore',   label: 'Indore, MP'   },
    { slug: 'bhopal',   label: 'Bhopal, MP'   },
    { slug: 'jabalpur', label: 'Jabalpur, MP' },
    { slug: 'rewa',     label: 'Rewa, MP'     },
    { slug: 'mumbai',   label: 'Mumbai, MH'   },
    { slug: 'pune',     label: 'Pune, MH'     },
];

const FALLBACK_CATEGORIES = ['Full Home Interior','Kitchen','Bedroom','Living Room','Bathroom','TV Unit','Kids Room','Commercial','Office','Villa / Bungalow','Apartment','Renovation','Housing Society'];

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
const FALLBACK_TYPES      = ['Residential','Commercial'];

/* ── Reusable inline-add + drag-reorder hook ── */
function useManageableList({ url, apiBase, token, fallback, broadcastEvent }) {
    const [objects,   setObjects]   = useState([]);
    const [names,     setNames]     = useState(fallback);
    const [open,      setOpen]      = useState(false);
    const [adding,    setAdding]    = useState(false);
    const [newName,   setNewName]   = useState('');
    const [saving,    setSaving]    = useState(false);
    const [confirm,   setConfirm]   = useState(null);
    const [deleting,  setDeleting]  = useState(false);
    const [showReorder, setShowReorder] = useState(false);
    const [dragIdx,   setDragIdx]   = useState(null);
    const [dragOver,  setDragOver]  = useState(null);
    const ref = useRef(null);

    const fetch_ = async () => {
        try {
            const res = await axios.get(`${url}${apiBase}/list`);
            if (res.data.success) {
                setObjects(res.data.data);
                setNames(res.data.data.map(c => c.name));
            }
        } catch { setNames(fallback); }
    };

    useEffect(() => { fetch_(); }, []);

    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setAdding(false); } };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const add = async () => {
        if (!newName.trim()) { toast.error('Name is required'); return; }
        setSaving(true);
        try {
            const res = await axios.post(`${url}${apiBase}/add`, { name: newName.trim() }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) { toast.success(res.data.message); setNewName(''); setAdding(false); await fetch_(); setOpen(false); return res.data.data.name; }
            else toast.error(res.data.message);
        } catch { toast.error('Failed to add'); }
        finally { setSaving(false); }
    };

    const remove_ = (obj) => { setOpen(false); setConfirm(obj); };

    const confirmRemove = async () => {
        if (!confirm || deleting) return;
        setDeleting(true);
        try {
            const res = await axios.post(`${url}${apiBase}/remove`, { _id: confirm._id }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) { toast.success(res.data.message); setConfirm(null); await fetch_(); }
            else toast.error(res.data.message);
        } catch { toast.error('Failed to remove'); }
        finally { setDeleting(false); }
    };

    const saveReorder = async (reordered) => {
        setObjects(reordered); setNames(reordered.map(c => c.name));
        try { await axios.post(`${url}${apiBase}/reorder`, { order: reordered.map((c, i) => ({ _id: c._id, order: i + 1 })) }, { headers: { Authorization: `Bearer ${token}` } }); }
        catch { toast.error('Failed to save order'); await fetch_(); }
    };

    const onDragStart = (i) => setDragIdx(i);
    const onDragOver  = (e, i) => { e.preventDefault(); setDragOver(i); };
    const onDragEnd   = () => { setDragIdx(null); setDragOver(null); };
    const onDrop      = async (e, di) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === di) { onDragEnd(); return; }
        const r = [...objects]; const [m] = r.splice(dragIdx, 1); r.splice(di, 0, m);
        onDragEnd(); await saveReorder(r);
    };
    const onTouchStart = (e, i) => setDragIdx(i);
    const onTouchMove  = (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const el = document.elementFromPoint(t.clientX, t.clientY)?.closest('[data-ri]');
        if (el) { const i = parseInt(el.dataset.ri, 10); if (!isNaN(i)) setDragOver(i); }
    };
    const onTouchEnd = async () => {
        if (dragIdx !== null && dragOver !== null && dragIdx !== dragOver) {
            const r = [...objects]; const [m] = r.splice(dragIdx, 1); r.splice(dragOver, 0, m);
            onDragEnd(); await saveReorder(r);
        } else { onDragEnd(); }
    };

    return { objects, names, open, setOpen, adding, setAdding, newName, setNewName, saving, add, remove_, confirm, setConfirm, confirmRemove, deleting, showReorder, setShowReorder, dragIdx, dragOver, onDragStart, onDragOver, onDrop, onDragEnd, onTouchStart, onTouchMove, onTouchEnd, ref };
}

/* ── Dropdown with add/remove/reorder (single or multi-select) ── */
function ManagedDropdown({ label: fieldLabel, value, values, onChange, multiSelect, list, dropdownOpen, setDropdownOpen, adding, setAdding, newName, setNewName, saving, onAdd, onRemove, showReorder, setShowReorder, reorderProps, dropRef, placeholder = '— Select —' }) {
    const selected = multiSelect ? (values || []) : [];

    const toggleMulti = (name) => {
        const next = selected.includes(name) ? selected.filter(n => n !== name) : [...selected, name];
        onChange(next);
    };

    const triggerLabel = multiSelect
        ? (selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} categories selected`)
        : (value || placeholder);

    return (
        <div className="add-cat-dropdown-wrap flex-col">
            <h2>{fieldLabel}</h2>

            {/* Selected chips (multi-select only) */}
            {multiSelect && selected.length > 0 && (
                <div className="proj-cat-chips">
                    {selected.map(name => (
                        <span key={name} className="proj-cat-chip">
                            {name}
                            <button type="button" onClick={() => toggleMulti(name)} aria-label={`Remove ${name}`}>×</button>
                        </span>
                    ))}
                </div>
            )}

            <div className="add-cat-dropdown" ref={dropRef}>
                <button type="button" className={`add-cat-trigger${dropdownOpen ? ' open' : ''}`} onClick={() => { setDropdownOpen(o => !o); setAdding(false); }}>
                    <span>{triggerLabel}</span>
                    <i className="fa fa-chevron-down" />
                </button>
                {dropdownOpen && (
                    <ul className="add-cat-list">
                        {list.objects.map((obj, i) => {
                            const isSelected = multiSelect ? selected.includes(obj.name) : value === obj.name;
                            return (
                            <li key={obj._id} className={`add-cat-option${isSelected ? ' active' : ''}`}
                                onClick={() => {
                                    if (multiSelect) { toggleMulti(obj.name); }
                                    else { onChange(obj.name); setDropdownOpen(false); setAdding(false); }
                                }}>
                                {multiSelect && <i className={`fa ${isSelected ? 'fa-square-check' : 'fa-square'} proj-cat-checkbox`} />}
                                <span>{obj.name}</span>
                                <div className="add-cat-option-actions" onClick={e => e.stopPropagation()}>
                                    {!multiSelect && isSelected && <i className="fa fa-check" />}
                                    <i className="fa fa-trash add-cat-trash" title={`Remove "${obj.name}"`} onClick={e => { e.stopPropagation(); onRemove(obj); }} />
                                </div>
                            </li>
                            );
                        })}
                        {!adding ? (
                            <li className="add-cat-option add-cat-new-btn" onClick={e => { e.stopPropagation(); setAdding(true); }}>
                                <i className="fa fa-plus" /><span>Add new</span>
                            </li>
                        ) : (
                            <li className="add-cat-new-form" onClick={e => e.stopPropagation()}>
                                <input type="text" placeholder={`e.g. ${fieldLabel}`} value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
                                <div className="add-cat-new-actions">
                                    <button type="button" className="add-cat-save-btn" onClick={onAdd} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                                    <button type="button" className="add-cat-cancel-btn" onClick={() => { setAdding(false); setNewName(''); }}>Cancel</button>
                                </div>
                            </li>
                        )}
                    </ul>
                )}
            </div>

            {/* Reorder toggle */}
            <div className="cat-reorder-wrap" style={{ marginTop: '8px' }}>
                <button type="button" className={`cat-reorder-toggle${showReorder ? ' active' : ''}`} onClick={() => setShowReorder(o => !o)}>
                    <i className="fa fa-grip-lines" />
                    {showReorder ? 'Done Reordering' : `Reorder ${fieldLabel}s`}
                    <i className={`fa fa-chevron-${showReorder ? 'up' : 'down'} cat-reorder-chevron`} />
                </button>
                {showReorder && (
                    <ul className="cat-reorder-list">
                        {list.objects.map((obj, i) => (
                            <li key={obj._id} data-ri={i}
                                className={`cat-reorder-item${reorderProps.dragOver === i ? ' drag-over' : ''}${reorderProps.dragIdx === i ? ' dragging' : ''}`}
                                draggable
                                onDragStart={() => reorderProps.onDragStart(i)}
                                onDragOver={e => reorderProps.onDragOver(e, i)}
                                onDrop={e => reorderProps.onDrop(e, i)}
                                onDragEnd={reorderProps.onDragEnd}
                                onTouchStart={e => reorderProps.onTouchStart(e, i)}
                                onTouchMove={reorderProps.onTouchMove}
                                onTouchEnd={reorderProps.onTouchEnd}
                            >
                                <i className="fa fa-grip-vertical cat-drag-handle" />
                                <span className="cat-reorder-name">{obj.name}</span>
                                <span className="cat-reorder-pos">{i + 1}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

const AddProject = ({ url, setIsLoading, isLoading }) => {
    const token = localStorage.getItem('token');

    const [images, setImages] = useState([]);
    const [data, setData] = useState({
        name: '', description: '', categories: [], projectType: '',
        location: '', area: '', duration: '', completedAt: '', clientTestimonial: '',
        isFeatured: false, showInCityPage: false, cityPage: '',
    });
    const [points,   setPoints]   = useState(['']);
    const [cityOpen, setCityOpen] = useState(false);
    const [catDropOpen,  setCatDropOpen]  = useState(false);
    const [typeDropOpen, setTypeDropOpen] = useState(false);
    const cityRef = useRef(null);

    const catList  = useManageableList({ url, apiBase: '/api/project-category', token, fallback: FALLBACK_CATEGORIES });
    const typeList = useManageableList({ url, apiBase: '/api/project-type',     token, fallback: FALLBACK_TYPES });

    // Set default type once list loads
    useEffect(() => { if (!data.projectType && typeList.names.length) setData(p => ({ ...p, projectType: typeList.names[0] })); }, [typeList.names]);

    useEffect(() => {
        const h = (e) => { if (cityRef.current && !cityRef.current.contains(e.target)) setCityOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const onChangeHandler = (e) => {
        const { name, value, type, checked } = e.target;
        setData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    };

    const onPointChange = (i, v) => { const p = [...points]; p[i] = v; setPoints(p); };
    const addPoint      = ()     => setPoints([...points, '']);
    const removePoint   = (i)    => setPoints(points.filter((_, idx) => idx !== i));
    const onImageChange = (e)    => setImages(p => [...p, ...Array.from(e.target.files)]);
    const removeImage   = (i)    => setImages(images.filter((_, idx) => idx !== i));
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
        fd.append('name', data.name); fd.append('description', data.description);
        fd.append('categories', JSON.stringify(data.categories)); fd.append('projectType', data.projectType);
        fd.append('location', data.location); fd.append('area', data.area);
        fd.append('duration', data.duration); fd.append('completedAt', data.completedAt);
        fd.append('clientTestimonial', data.clientTestimonial);
        fd.append('isFeatured', data.isFeatured);
        fd.append('cityPage', data.showInCityPage ? data.cityPage : '');
        fd.append('points', JSON.stringify(points.filter(p => p.trim())));
        images.forEach(img => fd.append('images', img));
        try {
            const res = await axios.post(`${url}/api/project/add`, fd, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) {
                setData({ name: '', description: '', categories: [], projectType: typeList.names[0] || '', location: '', area: '', duration: '', completedAt: '', clientTestimonial: '', isFeatured: false, showInCityPage: false, cityPage: '' });
                setPoints(['']); setImages([]);
                toast.success(res.data.message);
            } else { toast.error(res.data.message); }
        } catch { toast.error('An error occurred while adding the project.'); }
        finally { setIsLoading(false); }
    };

    return (
        <>
        <div className="add">
            <form className="flex-col" onSubmit={onSubmit}>

                {/* ── Images ── */}
                <div className="add-img-upload flex-col">
                    <h2>Project Images {images.length > 1 && <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#888' }}>— number shows display order on the site</span>}</h2>
                    <label htmlFor="proj-image" className="upload-icon"><i className="fa fa-upload" /></label>
                    <input onChange={onImageChange} type="file" id="proj-image" multiple hidden />
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
                    <h2>Project Name</h2>
                    <input name="name" value={data.name} onChange={onChangeHandler} type="text" placeholder="e.g. The Mehta Residence" required />
                </div>

                {/* ── Description ── */}
                <div className="add-product-description flex-col">
                    <h2>Description</h2>
                    <textarea name="description" value={data.description} onChange={onChangeHandler} rows="5" placeholder="Describe the project…" required />
                </div>

                {/* ── Category + Type ── */}
                <div className="add-category-price" style={{ alignItems: 'flex-start' }}>
                    <ManagedDropdown
                        label="Category"
                        multiSelect
                        values={data.categories}
                        onChange={v => setData(p => ({ ...p, categories: v }))}
                        placeholder="— Select categories —"
                        list={catList}
                        dropdownOpen={catDropOpen}
                        setDropdownOpen={setCatDropOpen}
                        adding={catList.adding}
                        setAdding={catList.setAdding}
                        newName={catList.newName}
                        setNewName={catList.setNewName}
                        saving={catList.saving}
                        onAdd={catList.add}
                        onRemove={catList.remove_}
                        showReorder={catList.showReorder}
                        setShowReorder={catList.setShowReorder}
                        reorderProps={{ dragIdx: catList.dragIdx, dragOver: catList.dragOver, onDragStart: catList.onDragStart, onDragOver: catList.onDragOver, onDrop: catList.onDrop, onDragEnd: catList.onDragEnd, onTouchStart: catList.onTouchStart, onTouchMove: catList.onTouchMove, onTouchEnd: catList.onTouchEnd }}
                        dropRef={catList.ref}
                    />
                    <ManagedDropdown
                        label="Project Type"
                        value={data.projectType}
                        onChange={v => setData(p => ({ ...p, projectType: v }))}
                        list={typeList}
                        dropdownOpen={typeDropOpen}
                        setDropdownOpen={setTypeDropOpen}
                        adding={typeList.adding}
                        setAdding={typeList.setAdding}
                        newName={typeList.newName}
                        setNewName={typeList.setNewName}
                        saving={typeList.saving}
                        onAdd={typeList.add}
                        onRemove={typeList.remove_}
                        showReorder={typeList.showReorder}
                        setShowReorder={typeList.setShowReorder}
                        reorderProps={{ dragIdx: typeList.dragIdx, dragOver: typeList.dragOver, onDragStart: typeList.onDragStart, onDragOver: typeList.onDragOver, onDrop: typeList.onDrop, onDragEnd: typeList.onDragEnd, onTouchStart: typeList.onTouchStart, onTouchMove: typeList.onTouchMove, onTouchEnd: typeList.onTouchEnd }}
                        dropRef={typeList.ref}
                    />
                </div>

                {/* ── Location ── */}
                <div className="add-product-name flex-col">
                    <h2>Location</h2>
                    <input name="location" value={data.location} onChange={onChangeHandler} type="text" placeholder="e.g. Satna, MP" required />
                </div>

                {/* ── Area + Duration ── */}
                <div className="add-category-price">
                    <div className="add-category flex-col">
                        <h2>Area</h2>
                        <input name="area" value={data.area} onChange={onChangeHandler} type="text" placeholder="e.g. 1500 sq.ft" />
                    </div>
                    <div className="add-category flex-col">
                        <h2>Duration</h2>
                        <input name="duration" value={data.duration} onChange={onChangeHandler} type="text" placeholder="e.g. 8 weeks" />
                    </div>
                </div>

                {/* ── Completion Date ── */}
                <div className="add-product-name flex-col">
                    <h2>Completion Date</h2>
                    <input name="completedAt" value={data.completedAt} onChange={onChangeHandler} type="date" />
                </div>

                {/* ── Featured ── */}
                <label className={`add-feature-card${data.isFeatured ? ' active' : ''}`}>
                    <div className="add-feature-left">
                        <div className="add-feature-icon"><i className="fa fa-star" /></div>
                        <div className="add-feature-text">
                            <span className="add-feature-title">Feature on Projects Page</span>
                            <span className="add-feature-desc">Mark as featured — this project will always appear at the top of the projects page.</span>
                        </div>
                    </div>
                    <input type="checkbox" name="isFeatured" checked={data.isFeatured} onChange={onChangeHandler} style={{ display: 'none' }} />
                    <span className="toggle-slider" />
                </label>

                {/* ── City Page ── */}
                <label className={`add-feature-card${data.showInCityPage ? ' active' : ''}`}>
                    <div className="add-feature-left">
                        <div className="add-feature-icon"><i className="fa fa-location-dot" /></div>
                        <div className="add-feature-text">
                            <span className="add-feature-title">Show on a City Page</span>
                            <span className="add-feature-desc">This project will also appear on the selected city's page.</span>
                        </div>
                    </div>
                    <input type="checkbox" name="showInCityPage" checked={data.showInCityPage} onChange={onChangeHandler} style={{ display: 'none' }} />
                    <span className="toggle-slider" />
                </label>
                {data.showInCityPage && (
                    <div className="add-cat-dropdown-wrap flex-col">
                        <h2>Select City</h2>
                        <div className="add-cat-dropdown" ref={cityRef}>
                            <button type="button" className={`add-cat-trigger${cityOpen ? ' open' : ''}`} onClick={() => setCityOpen(o => !o)}>
                                <span>{data.cityPage ? CITY_OPTIONS.find(c => c.slug === data.cityPage)?.label : '— Pick a city —'}</span>
                                <i className="fa fa-chevron-down" />
                            </button>
                            {cityOpen && (
                                <ul className="add-cat-list">
                                    {CITY_OPTIONS.map(c => (
                                        <li key={c.slug} className={`add-cat-option${data.cityPage === c.slug ? ' active' : ''}`} onClick={() => { setData(p => ({ ...p, cityPage: c.slug })); setCityOpen(false); }}>
                                            <span>{c.label}</span>
                                            {data.cityPage === c.slug && <i className="fa fa-check" />}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Points ── */}
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

                {/* ── Client Testimonial ── */}
                <div className="add-product-description flex-col">
                    <h2>Client Testimonial</h2>
                    <textarea name="clientTestimonial" value={data.clientTestimonial} onChange={onChangeHandler} rows="3" placeholder="Optional — paste a quote from the client here…" />
                </div>

                <button type="submit" className="add-btn" disabled={isLoading}>
                    {isLoading ? 'Uploading…' : 'Add Project'}
                </button>
            </form>
        </div>

        {/* ── Confirm delete modals ── */}
        {[catList, typeList].map((list, idx) => list.confirm && ReactDOM.createPortal(
            <div key={idx} className="bin-confirm-backdrop" onClick={() => !list.deleting && list.setConfirm(null)}>
                <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                    <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                    <h3>Remove {idx === 0 ? 'Category' : 'Type'}?</h3>
                    <p className="bin-confirm-name">"{list.confirm.name}"</p>
                    <p className="bin-confirm-warning">
                        Moved to Recovery Bin. <strong>Projects inside are kept safe.</strong>
                    </p>
                    <div className="bin-confirm-actions">
                        <button className="bin-btn-cancel" onClick={() => list.setConfirm(null)} disabled={list.deleting}>Cancel</button>
                        <button className="bin-btn-delete" onClick={list.confirmRemove} disabled={list.deleting}>
                            {list.deleting ? <><i className="fa-solid fa-circle-notch fa-spin" /> Removing…</> : <><i className="fa-solid fa-trash" /> Yes, Remove</>}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        ))}
        </>
    );
};

export default AddProject;
