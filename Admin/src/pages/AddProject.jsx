import React, { useState, useRef, useEffect } from 'react';
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

const PROJECT_CATEGORIES = [
    'Full Home Interior', 'Kitchen', 'Bedroom', 'Living Room',
    'Bathroom', 'TV Unit', 'Kids Room', 'Commercial', 'Office',
    'Villa / Bungalow', 'Apartment', 'Renovation', 'Housing Society',
];

const AddProject = ({ url, setIsLoading, isLoading }) => {
    const [images, setImages] = useState([]);
    const [data, setData] = useState({
        name:              '',
        description:       '',
        category:          PROJECT_CATEGORIES[0],
        projectType:       'Residential',
        location:          '',
        area:              '',
        duration:          '',
        completedAt:       '',
        clientTestimonial: '',
        isFeatured:        false,
        showInCityPage:    false,
        cityPage:          '',
    });
    const [points,   setPoints]   = useState(['']);
    const [catOpen,  setCatOpen]  = useState(false);
    const [cityOpen, setCityOpen] = useState(false);
    const catRef  = useRef(null);
    const cityRef = useRef(null);

    const token = localStorage.getItem('token');

    useEffect(() => {
        const handleOutside = (e) => {
            if (catRef.current  && !catRef.current.contains(e.target))  setCatOpen(false);
            if (cityRef.current && !cityRef.current.contains(e.target)) setCityOpen(false);
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const onChangeHandler = (e) => {
        const { name, value, type, checked } = e.target;
        setData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const onPointChange    = (i, v) => { const p = [...points]; p[i] = v; setPoints(p); };
    const addPoint         = ()     => setPoints([...points, '']);
    const removePoint      = (i)    => setPoints(points.filter((_, idx) => idx !== i));

    const onImageChange    = (e)    => setImages(prev => [...prev, ...Array.from(e.target.files)]);
    const removeImage      = (i)    => setImages(images.filter((_, idx) => idx !== i));

    const onSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const fd = new FormData();
        fd.append('name',              data.name);
        fd.append('description',       data.description);
        fd.append('category',          data.category);
        fd.append('projectType',       data.projectType);
        fd.append('location',          data.location);
        fd.append('area',              data.area);
        fd.append('duration',          data.duration);
        fd.append('completedAt',       data.completedAt);
        fd.append('clientTestimonial', data.clientTestimonial);
        fd.append('isFeatured',        data.isFeatured);
        fd.append('cityPage',          data.showInCityPage ? data.cityPage : '');
        fd.append('points',            JSON.stringify(points.filter(p => p.trim())));
        images.forEach(img => fd.append('images', img));

        try {
            const res = await axios.post(`${url}/api/project/add`, fd, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                setData({
                    name: '', description: '', category: PROJECT_CATEGORIES[0],
                    projectType: 'Residential', location: '', area: '',
                    duration: '', completedAt: '', clientTestimonial: '',
                    isFeatured: false, showInCityPage: false, cityPage: '',
                });
                setPoints(['']);
                setImages([]);
                toast.success(res.data.message);
            } else {
                toast.error(res.data.message);
            }
        } catch {
            toast.error('An error occurred while adding the project.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="add">
            <form className="flex-col" onSubmit={onSubmit}>

                {/* ── Images ── */}
                <div className="add-img-upload flex-col">
                    <h2>Project Images</h2>
                    <label htmlFor="proj-image" className="upload-icon">
                        <i className="fa fa-upload" />
                    </label>
                    <input onChange={onImageChange} type="file" id="proj-image" multiple hidden />
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
                    <h2>Project Name</h2>
                    <input
                        name="name" value={data.name} onChange={onChangeHandler}
                        type="text" placeholder="e.g. The Mehta Residence" required
                    />
                </div>

                {/* ── Description ── */}
                <div className="add-product-description flex-col">
                    <h2>Description</h2>
                    <textarea
                        name="description" value={data.description} onChange={onChangeHandler}
                        rows="5" placeholder="Describe the project — scope, design intent, challenges overcome…" required
                    />
                </div>

                {/* ── Category + Project Type ── */}
                <div className="add-category-price">
                    <div className="add-cat-dropdown-wrap flex-col">
                        <h2>Category</h2>
                        <div className="add-cat-dropdown" ref={catRef}>
                            <button
                                type="button"
                                className={`add-cat-trigger${catOpen ? ' open' : ''}`}
                                onClick={() => setCatOpen(o => !o)}
                            >
                                <span>{data.category}</span>
                                <i className="fa fa-chevron-down" />
                            </button>
                            {catOpen && (
                                <ul className="add-cat-list">
                                    {PROJECT_CATEGORIES.map((cat, i) => (
                                        <li
                                            key={i}
                                            className={`add-cat-option${data.category === cat ? ' active' : ''}`}
                                            onClick={() => {
                                                setData(prev => ({ ...prev, category: cat }));
                                                setCatOpen(false);
                                            }}
                                        >
                                            <span>{cat}</span>
                                            {data.category === cat && <i className="fa fa-check" />}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                    <div className="add-category flex-col">
                        <h2>Project Type</h2>
                        <select name="projectType" value={data.projectType} onChange={onChangeHandler}>
                            <option value="Residential">Residential</option>
                            <option value="Commercial">Commercial</option>
                        </select>
                    </div>
                </div>

                {/* ── Location ── */}
                <div className="add-product-name flex-col">
                    <h2>Location</h2>
                    <input
                        name="location" value={data.location} onChange={onChangeHandler}
                        type="text" placeholder="e.g. Satna, MP" required
                    />
                </div>

                {/* ── Area + Duration ── */}
                <div className="add-category-price">
                    <div className="add-category flex-col">
                        <h2>Area</h2>
                        <input
                            name="area" value={data.area} onChange={onChangeHandler}
                            type="text" placeholder="e.g. 1500 sq.ft"
                        />
                    </div>
                    <div className="add-category flex-col">
                        <h2>Duration</h2>
                        <input
                            name="duration" value={data.duration} onChange={onChangeHandler}
                            type="text" placeholder="e.g. 8 weeks"
                        />
                    </div>
                </div>

                {/* ── Completion Date ── */}
                <div className="add-product-name flex-col">
                    <h2>Completion Date</h2>
                    <input
                        name="completedAt" value={data.completedAt} onChange={onChangeHandler}
                        type="date"
                    />
                </div>

                {/* ── Featured card ── */}
                <label className={`add-feature-card${data.isFeatured ? ' active' : ''}`}>
                    <div className="add-feature-left">
                        <div className="add-feature-icon">
                            <i className="fa fa-star" />
                        </div>
                        <div className="add-feature-text">
                            <span className="add-feature-title">Feature on Projects Page</span>
                            <span className="add-feature-desc">
                                Mark as featured — this project will always appear at the top of the projects page.
                            </span>
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        name="isFeatured"
                        checked={data.isFeatured}
                        onChange={onChangeHandler}
                        style={{ display: 'none' }}
                    />
                    <span className="toggle-slider" />
                </label>

                {/* ── City Page ── */}
                <label className={`add-feature-card${data.showInCityPage ? ' active' : ''}`}>
                    <div className="add-feature-left">
                        <div className="add-feature-icon">
                            <i className="fa fa-location-dot" />
                        </div>
                        <div className="add-feature-text">
                            <span className="add-feature-title">Show on a City Page</span>
                            <span className="add-feature-desc">
                                This project will also appear on the selected city's page.
                            </span>
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        name="showInCityPage"
                        checked={data.showInCityPage}
                        onChange={onChangeHandler}
                        style={{ display: 'none' }}
                    />
                    <span className="toggle-slider" />
                </label>
                {data.showInCityPage && (
                    <div className="add-cat-dropdown-wrap flex-col">
                        <h2>Select City</h2>
                        <div className="add-cat-dropdown" ref={cityRef}>
                            <button
                                type="button"
                                className={`add-cat-trigger${cityOpen ? ' open' : ''}`}
                                onClick={() => setCityOpen(o => !o)}
                            >
                                <span>{data.cityPage ? CITY_OPTIONS.find(c => c.slug === data.cityPage)?.label : '— Pick a city —'}</span>
                                <i className="fa fa-chevron-down" />
                            </button>
                            {cityOpen && (
                                <ul className="add-cat-list">
                                    {CITY_OPTIONS.map(c => (
                                        <li
                                            key={c.slug}
                                            className={`add-cat-option${data.cityPage === c.slug ? ' active' : ''}`}
                                            onClick={() => {
                                                setData(prev => ({ ...prev, cityPage: c.slug }));
                                                setCityOpen(false);
                                            }}
                                        >
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
                            <input
                                type="text" value={pt}
                                onChange={e => onPointChange(i, e.target.value)}
                                placeholder={`Highlight ${i + 1}`}
                            />
                            <button type="button" onClick={() => removePoint(i)} className="remove-point-btn">Remove</button>
                        </div>
                    ))}
                    <button type="button" className="add-point-btn" onClick={addPoint}>+ Add Highlight</button>
                </div>

                {/* ── Client Testimonial ── */}
                <div className="add-product-description flex-col">
                    <h2>Client Testimonial</h2>
                    <textarea
                        name="clientTestimonial" value={data.clientTestimonial} onChange={onChangeHandler}
                        rows="3" placeholder="Optional — paste a quote from the client here…"
                    />
                </div>

                <button type="submit" className="add-btn" disabled={isLoading}>
                    {isLoading ? 'Uploading…' : 'Add Project'}
                </button>

            </form>
        </div>
    );
};

export default AddProject;
