import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useIconTagManager, SubcategorySection, ConfirmTagDeleteModal } from '../components/IconTagManager';

const FALLBACK_CATEGORIES = [
    'Kitchen Designs', 'Bedroom Designs', 'Bathroom Designs',
    'Lounge area Designs', 'Kids Room Designs', 'TV Unit Designs',
    'Commercial Designs', 'Mandir Designs', 'Garden Designs', 'House Exterior',
];

const FALLBACK_SUBCATEGORIES = [
    'Modular Kitchen', 'Island Kitchen', 'Master Bedroom', 'Walk-in Wardrobe',
    'Vanity Units', 'Shower Cubicles', 'Seating Area', 'TV Panel',
    'Bunk Beds', 'Study Corner', 'Office Cabins', 'Reception Area',
    'Pooja Unit', 'Vertical Garden', 'Facade',
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

const AddDesign = ({ url, setIsLoading, isLoading }) => {
    const [images, setImages] = useState([]);
    const [data, setData] = useState({
        name: '', description: '', category: '', subcategories: [], isFeatured: false,
    });
    const [points,     setPoints]     = useState(['']);
    const [catOpen,    setCatOpen]    = useState(false);
    const [categories, setCategories] = useState(FALLBACK_CATEGORIES);

    const [subCatOpen, setSubCatOpen] = useState(false);
    const subCatRef = useRef(null);
    const [newParentCats, setNewParentCats] = useState([]);

    // inline add-category state
    const [addingCat,    setAddingCat]    = useState(false);
    const [confirmCatDel, setConfirmCatDel] = useState(null); // catObj pending delete
    const [catDeleting,   setCatDeleting]   = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newCatLabel,setNewCatLabel]= useState('');
    const [catSaving,  setCatSaving]  = useState(false);

    const catRef = useRef(null);
    const token  = localStorage.getItem('token');

    const [categoryObjects, setCategoryObjects] = useState([]);
    const [showReorder,    setShowReorder]    = useState(false);
    const [dragIndex,      setDragIndex]      = useState(null);
    const [dragOverIndex,  setDragOverIndex]  = useState(null);

    const subManager = useIconTagManager(url, token, '/api/design-subcategory', FALLBACK_SUBCATEGORIES, () => ({ categories: newParentCats }));

    const fetchCategories = async () => {
        try {
            const res = await axios.get(`${url}/api/category/list`);
            if (res.data.success) {
                setCategoryObjects(res.data.data);
                const names = res.data.data.map(c => c.name);
                setCategories(names);
                if (!data.category) setData(p => ({ ...p, category: names[0] || '' }));
            }
        } catch {
            setCategories(FALLBACK_CATEGORIES);
            if (!data.category) setData(p => ({ ...p, category: FALLBACK_CATEGORIES[0] }));
        }
    };

    const deleteCategory = (e, catObj) => {
        e.stopPropagation();
        setCatOpen(false);
        setConfirmCatDel(catObj);
    };

    const confirmDeleteCategory = async () => {
        if (!confirmCatDel || catDeleting) return;
        setCatDeleting(true);
        try {
            const res = await axios.post(`${url}/api/category/remove`,
                { _id: confirmCatDel._id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success(res.data.message);
                if (data.category === confirmCatDel.name) setData(p => ({ ...p, category: '' }));
                setConfirmCatDel(null);
                await fetchCategories();
            } else {
                toast.error(res.data.message);
            }
        } catch {
            toast.error('Failed to remove category');
        } finally {
            setCatDeleting(false);
        }
    };

    useEffect(() => { fetchCategories(); }, []);

    useEffect(() => {
        const handleOutside = (e) => {
            if (catRef.current && !catRef.current.contains(e.target)) {
                setCatOpen(false);
                setAddingCat(false);
            }
            if (subCatRef.current && !subCatRef.current.contains(e.target)) {
                setSubCatOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const onChangeHandler = (e) => {
        const { name, value, type, checked } = e.target;
        setData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    };

    const selectCategory = (cat) => {
        setData(prev => {
            const validSubNames = subManager.objects.filter(s => s.categories?.includes(cat)).map(s => s.name);
            return { ...prev, category: cat, subcategories: prev.subcategories.filter(s => validSubNames.includes(s)) };
        });
        setCatOpen(false);
        setAddingCat(false);
    };

    const toggleSubcategory = (name) => {
        setData(prev => ({
            ...prev,
            subcategories: prev.subcategories.includes(name)
                ? prev.subcategories.filter(s => s !== name)
                : [...prev.subcategories, name],
        }));
    };

    const onPointChange   = (i, v) => { const p = [...points]; p[i] = v; setPoints(p); };
    const addPoint        = ()     => setPoints([...points, '']);
    const removePoint     = (i)    => setPoints(points.filter((_, idx) => idx !== i));
    const onImageChange   = (e)    => setImages(p => [...p, ...Array.from(e.target.files)]);
    const removeImage     = (i)    => setImages(images.filter((_, idx) => idx !== i));
    const moveImage = (index, direction) => {
        setImages(prev => {
            const next = [...prev];
            const target = index + direction;
            if (target < 0 || target >= next.length) return prev;
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const saveNewCategory = async () => {
        if (!newCatName.trim() || !newCatLabel.trim()) {
            toast.error('Both name and label are required');
            return;
        }
        setCatSaving(true);
        try {
            const res = await axios.post(`${url}/api/category/add`,
                { name: newCatName.trim(), label: newCatLabel.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                toast.success('Category added');
                setNewCatName(''); setNewCatLabel(''); setAddingCat(false);
                await fetchCategories();
                setData(p => ({ ...p, category: res.data.data.name }));
                setCatOpen(false);
            } else {
                toast.error(res.data.message);
            }
        } catch {
            toast.error('Failed to add category');
        } finally {
            setCatSaving(false);
        }
    };

    const onDragStart = (i) => setDragIndex(i);
    const onDragOver  = (e, i) => { e.preventDefault(); setDragOverIndex(i); };
    const onDragEnd   = () => { setDragIndex(null); setDragOverIndex(null); };

    const saveReorder = async (reordered) => {
        setCategoryObjects(reordered);
        setCategories(reordered.map(c => c.name));
        try {
            await axios.post(`${url}/api/category/reorder`,
                { order: reordered.map((c, idx) => ({ _id: c._id, order: idx + 1 })) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch {
            toast.error('Failed to save order');
            await fetchCategories();
        }
    };

    const onDrop = async (e, dropIndex) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === dropIndex) { onDragEnd(); return; }
        const reordered = [...categoryObjects];
        const [moved] = reordered.splice(dragIndex, 1);
        reordered.splice(dropIndex, 0, moved);
        onDragEnd();
        await saveReorder(reordered);
    };

    // ── Touch drag-and-drop (mobile) ──
    const onTouchStart = (e, i) => {
        setDragIndex(i);
    };

    const onTouchMove = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const item = el?.closest('[data-reorder-index]');
        if (item) {
            const idx = parseInt(item.dataset.reorderIndex, 10);
            if (!isNaN(idx)) setDragOverIndex(idx);
        }
    };

    const onTouchEnd = async () => {
        if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
            const reordered = [...categoryObjects];
            const [moved] = reordered.splice(dragIndex, 1);
            reordered.splice(dragOverIndex, 0, moved);
            onDragEnd();
            await saveReorder(reordered);
        } else {
            onDragEnd();
        }
    };

    const onSubmitHandler = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const formData = new FormData();
        formData.append('name',        data.name);
        formData.append('description', data.description);
        formData.append('category',    data.category);
        formData.append('subcategories', JSON.stringify(data.subcategories));
        formData.append('isFeatured',  data.isFeatured);
        formData.append('points',      JSON.stringify(points.filter(p => p.trim())));
        images.forEach(img => formData.append('images', img));

        try {
            const res = await axios.post(`${url}/api/design/add`, formData, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                setData({ name: '', description: '', category: categories[0] || '', subcategories: [], isFeatured: false });
                setPoints(['']); setImages([]);
                toast.success(res.data.message);
            } else {
                toast.error(res.data.message);
            }
        } catch {
            toast.error('An error occurred while adding the design.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
        <div className="add">
            <form className="flex-col" onSubmit={onSubmitHandler}>

                {/* ── Images ── */}
                <div className="add-img-upload flex-col">
                    <h2>Upload Image {images.length > 1 && <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#888' }}>— number shows display order on the site</span>}</h2>
                    <label htmlFor="image" className="upload-icon">
                        <i className="fa fa-upload" />
                    </label>
                    <input onChange={onImageChange} type="file" id="image" multiple hidden />
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
                    <h2>Name</h2>
                    <input onChange={onChangeHandler} value={data.name} type="text" name="name" placeholder="Type here" required />
                </div>

                {/* ── Description ── */}
                <div className="add-product-description flex-col">
                    <h2>Description</h2>
                    <textarea onChange={onChangeHandler} value={data.description} name="description" rows="6" placeholder="Write about the item here." required />
                </div>

                {/* ── Points ── */}
                <div className="add-product-points flex-col">
                    <h2>Points</h2>
                    {points.map((pt, i) => (
                        <div key={i} className="point-input">
                            <input type="text" value={pt} onChange={e => onPointChange(i, e.target.value)} placeholder={`Point ${i + 1}`} />
                            <button type="button" onClick={() => removePoint(i)} className="remove-point-btn">Remove</button>
                        </div>
                    ))}
                    <button className="add-point-btn" type="button" onClick={addPoint}>+ Add Point</button>
                </div>

                {/* ── Category ── */}
                <div className="add-cat-dropdown-wrap flex-col">
                    <h2>Category</h2>
                    <div className="add-cat-dropdown" ref={catRef}>
                        <button
                            type="button"
                            className={`add-cat-trigger${catOpen ? ' open' : ''}`}
                            onClick={() => { setCatOpen(o => !o); setAddingCat(false); }}
                        >
                            <span>{data.category || 'Select category'}</span>
                            <i className="fa fa-chevron-down" />
                        </button>

                        {catOpen && (
                            <ul className="add-cat-list">
                                {categories.map((cat, i) => {
                                    const catObj = categoryObjects.find(c => c.name === cat);
                                    return (
                                        <li
                                            key={i}
                                            className={`add-cat-option${data.category === cat ? ' active' : ''}`}
                                            onClick={() => selectCategory(cat)}
                                        >
                                            <span>{cat}</span>
                                            <div className="add-cat-option-actions" onClick={e => e.stopPropagation()}>
                                                {data.category === cat && <i className="fa fa-check" />}
                                                {catObj && (
                                                    <i
                                                        className="fa fa-trash add-cat-trash"
                                                        title={`Remove "${cat}"`}
                                                        onClick={e => deleteCategory(e, catObj)}
                                                    />
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}

                                {/* ── Add new category row ── */}
                                {!addingCat ? (
                                    <li
                                        className="add-cat-option add-cat-new-btn"
                                        onClick={(e) => { e.stopPropagation(); setAddingCat(true); }}
                                    >
                                        <i className="fa fa-plus" />
                                        <span>Add new category</span>
                                    </li>
                                ) : (
                                    <li className="add-cat-new-form" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="text"
                                            placeholder="Name e.g. Pooja Room Designs"
                                            value={newCatName}
                                            onChange={e => setNewCatName(e.target.value)}
                                            autoFocus
                                        />
                                        <input
                                            type="text"
                                            placeholder="Short label e.g. Pooja Room"
                                            value={newCatLabel}
                                            onChange={e => setNewCatLabel(e.target.value)}
                                        />
                                        <div className="add-cat-new-actions">
                                            <button type="button" className="add-cat-save-btn" onClick={saveNewCategory} disabled={catSaving}>
                                                {catSaving ? 'Saving…' : 'Save'}
                                            </button>
                                            <button type="button" className="add-cat-cancel-btn" onClick={() => { setAddingCat(false); setNewCatName(''); setNewCatLabel(''); }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </li>
                                )}
                            </ul>
                        )}
                    </div>
                </div>

                {/* ── Subcategories ── */}
                {data.category && (
                    <SubcategorySection
                        subManager={subManager}
                        catManager={{ objects: categoryObjects }}
                        values={data.subcategories}
                        onToggle={toggleSubcategory}
                        availableForCategories={[data.category]}
                        dropdownOpen={subCatOpen}
                        setDropdownOpen={setSubCatOpen}
                        dropRef={subCatRef}
                        newParentCats={newParentCats}
                        setNewParentCats={setNewParentCats}
                    />
                )}

                {/* ── Reorder categories ── */}
                <div className="cat-reorder-wrap">
                    <button
                        type="button"
                        className={`cat-reorder-toggle${showReorder ? ' active' : ''}`}
                        onClick={() => setShowReorder(o => !o)}
                    >
                        <i className="fa fa-grip-lines" />
                        {showReorder ? 'Done Reordering' : 'Reorder Categories'}
                        <i className={`fa fa-chevron-${showReorder ? 'up' : 'down'} cat-reorder-chevron`} />
                    </button>

                    {showReorder && (
                        <ul className="cat-reorder-list">
                            {categoryObjects.map((cat, i) => (
                                <li
                                    key={cat._id}
                                    data-reorder-index={i}
                                    className={`cat-reorder-item${dragOverIndex === i ? ' drag-over' : ''}${dragIndex === i ? ' dragging' : ''}`}
                                    draggable
                                    onDragStart={() => onDragStart(i)}
                                    onDragOver={e => onDragOver(e, i)}
                                    onDrop={e => onDrop(e, i)}
                                    onDragEnd={onDragEnd}
                                    onTouchStart={e => onTouchStart(e, i)}
                                    onTouchMove={onTouchMove}
                                    onTouchEnd={onTouchEnd}
                                >
                                    <i className="fa fa-grip-vertical cat-drag-handle" />
                                    <span className="cat-reorder-name">{cat.name}</span>
                                    {cat.label && <span className="cat-reorder-label">{cat.label}</span>}
                                    <span className="cat-reorder-pos">{i + 1}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* ── Featured ── */}
                <label className={`add-feature-card${data.isFeatured ? ' active' : ''}`}>
                    <div className="add-feature-left">
                        <div className="add-feature-icon"><i className="fa fa-star" /></div>
                        <div className="add-feature-text">
                            <span className="add-feature-title">Feature on Homepage</span>
                            <span className="add-feature-desc">Mark as featured — this design will appear in the Featured Picks slider on the design display page.</span>
                        </div>
                    </div>
                    <input type="checkbox" name="isFeatured" checked={data.isFeatured} onChange={onChangeHandler} style={{ display: 'none' }} />
                    <span className="toggle-slider" />
                </label>

                <button type="submit" className="add-btn" disabled={isLoading}>
                    {isLoading ? 'Adding...' : 'Add Design'}
                </button>
            </form>
        </div>

        {/* ── Category delete confirmation modal ── */}
        {confirmCatDel && ReactDOM.createPortal(
            <div className="bin-confirm-backdrop" onClick={() => !catDeleting && setConfirmCatDel(null)}>
                <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                    <div className="bin-confirm-icon">
                        <i className="fa-solid fa-triangle-exclamation" />
                    </div>
                    <h3>Remove Category?</h3>
                    <p className="bin-confirm-name">"{confirmCatDel.name}"</p>
                    <p className="bin-confirm-warning">
                        This moves the category to the Recovery Bin.<br />
                        <strong>Designs inside are kept safe</strong> — they won't be deleted.
                    </p>
                    <div className="bin-confirm-actions">
                        <button className="bin-btn-cancel" onClick={() => setConfirmCatDel(null)} disabled={catDeleting}>
                            Cancel
                        </button>
                        <button className="bin-btn-delete" onClick={confirmDeleteCategory} disabled={catDeleting}>
                            {catDeleting
                                ? <><i className="fa-solid fa-circle-notch fa-spin" /> Removing…</>
                                : <><i className="fa-solid fa-trash" /> Yes, Remove</>
                            }
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}

        <ConfirmTagDeleteModal manager={subManager} typeLabel="Subcategory" onRemoved={(name) => setData(p => ({ ...p, subcategories: p.subcategories.filter(s => s !== name) }))} />
        </>
    );
};

export default AddDesign;
