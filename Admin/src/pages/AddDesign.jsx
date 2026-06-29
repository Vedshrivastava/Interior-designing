import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const FALLBACK_CATEGORIES = [
    'Kitchen Designs', 'Bedroom Designs', 'Bathroom Designs',
    'Lounge area Designs', 'Kids Room Designs', 'TV Unit Designs',
    'Commercial Designs', 'Mandir Designs', 'Garden Designs', 'House Exterior',
];

const AddDesign = ({ url, setIsLoading, isLoading }) => {
    const [images, setImages] = useState([]);
    const [data, setData] = useState({
        name: '', description: '', category: '', isFeatured: false,
    });
    const [points,     setPoints]     = useState(['']);
    const [catOpen,    setCatOpen]    = useState(false);
    const [categories, setCategories] = useState(FALLBACK_CATEGORIES);

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
                await fetchCategories();
            } else {
                toast.error(res.data.message);
            }
        } catch {
            toast.error('Failed to remove category');
        } finally {
            setCatDeleting(false);
            setConfirmCatDel(null);
        }
    };

    useEffect(() => { fetchCategories(); }, []);

    useEffect(() => {
        const handleOutside = (e) => {
            if (catRef.current && !catRef.current.contains(e.target)) {
                setCatOpen(false);
                setAddingCat(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const onChangeHandler = (e) => {
        const { name, value, type, checked } = e.target;
        setData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    };

    const onPointChange   = (i, v) => { const p = [...points]; p[i] = v; setPoints(p); };
    const addPoint        = ()     => setPoints([...points, '']);
    const removePoint     = (i)    => setPoints(points.filter((_, idx) => idx !== i));
    const onImageChange   = (e)    => setImages(p => [...p, ...Array.from(e.target.files)]);
    const removeImage     = (i)    => setImages(images.filter((_, idx) => idx !== i));

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

    const onSubmitHandler = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const formData = new FormData();
        formData.append('name',        data.name);
        formData.append('description', data.description);
        formData.append('category',    data.category);
        formData.append('isFeatured',  data.isFeatured);
        formData.append('points',      JSON.stringify(points.filter(p => p.trim())));
        images.forEach(img => formData.append('images', img));

        try {
            const res = await axios.post(`${url}/api/design/add`, formData, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                setData({ name: '', description: '', category: categories[0] || '', isFeatured: false });
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
        <div className="add">
            <form className="flex-col" onSubmit={onSubmitHandler}>

                {/* ── Images ── */}
                <div className="add-img-upload flex-col">
                    <h2>Upload Image</h2>
                    <label htmlFor="image" className="upload-icon">
                        <i className="fa fa-upload" />
                    </label>
                    <input onChange={onImageChange} type="file" id="image" multiple hidden />
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
                                            onClick={() => { setData(p => ({ ...p, category: cat })); setCatOpen(false); setAddingCat(false); }}
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
    );
};

export default AddDesign;
