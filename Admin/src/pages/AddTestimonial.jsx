import React, { useState } from 'react';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const AddTestimonial = ({ url }) => {
    const [image,    setImage]    = useState(null);
    const [preview,  setPreview]  = useState(null);
    const [loading,  setLoading]  = useState(false);
    const [data, setData] = useState({
        name: '', location: '', text: '', rating: 5, isActive: true,
    });
    const token = localStorage.getItem('token');

    const onChange = e => {
        const { name, value, type, checked } = e.target;
        setData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const onImage = e => {
        const file = e.target.files[0];
        if (!file) return;
        setImage(file);
        setPreview(URL.createObjectURL(file));
    };

    const onSubmit = async e => {
        e.preventDefault();
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('name',     data.name);
            fd.append('location', data.location);
            fd.append('text',     data.text);
            fd.append('rating',   data.rating);
            fd.append('isActive', data.isActive);
            if (image) fd.append('image', image);

            const res = await axios.post(`${url}/api/testimonial/add`, fd, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                toast.success('Testimonial added successfully!');
                setData({ name: '', location: '', text: '', rating: 5, isActive: true });
                setImage(null);
                setPreview(null);
            } else {
                toast.error(res.data.message || 'Failed to add testimonial.');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="add">
            <form className="flex-col" onSubmit={onSubmit}>

                {/* ── Client Photo ── */}
                <div className="add-img-upload flex-col">
                    <h2>Client Photo <span style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 400 }}>(optional)</span></h2>
                    <label htmlFor="t-image" className="upload-icon">
                        {preview
                            ? <img src={preview} alt="preview" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(201,168,124,0.4)' }} />
                            : <i className="fa fa-upload" />
                        }
                    </label>
                    <input onChange={onImage} type="file" id="t-image" accept="image/*" hidden />
                </div>

                {/* ── Client Name ── */}
                <div className="add-product-name flex-col">
                    <h2>Client Name</h2>
                    <input
                        name="name" value={data.name} onChange={onChange}
                        type="text" placeholder="e.g. Rahul Mehta" required
                    />
                </div>

                {/* ── Location ── */}
                <div className="add-product-name flex-col">
                    <h2>Location</h2>
                    <input
                        name="location" value={data.location} onChange={onChange}
                        type="text" placeholder="e.g. Mumbai" required
                    />
                </div>

                {/* ── Star Rating ── */}
                <div className="add-product-points flex-col">
                    <h2>Star Rating</h2>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                        {[1, 2, 3, 4, 5].map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setData(prev => ({ ...prev, rating: n }))}
                                style={{
                                    background: data.rating >= n ? 'rgba(201,168,124,0.2)' : 'rgba(201,168,124,0.06)',
                                    border: `1.5px solid ${data.rating >= n ? 'rgba(201,168,124,0.6)' : 'rgba(201,168,124,0.2)'}`,
                                    borderRadius: 8,
                                    padding: '8px 14px',
                                    cursor: 'pointer',
                                    color: data.rating >= n ? '#c9a87c' : 'rgba(201,168,124,0.4)',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    transition: 'all 0.15s',
                                }}
                            >★</button>
                        ))}
                        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: '#c9a87c', fontWeight: 600, marginLeft: 6 }}>
                            {data.rating} / 5
                        </span>
                    </div>
                </div>

                {/* ── Review Text ── */}
                <div className="add-product-description flex-col">
                    <h2>Review</h2>
                    <textarea
                        name="text" value={data.text} onChange={onChange}
                        rows={5} placeholder="Write the client's review here…" required
                    />
                </div>

                {/* ── Show on Website toggle ── */}
                <label className={`add-feature-card${data.isActive ? ' active' : ''}`}>
                    <div className="add-feature-left">
                        <div className="add-feature-icon">
                            <i className="fa fa-eye" />
                        </div>
                        <div className="add-feature-text">
                            <span className="add-feature-title">Show on Website</span>
                            <span className="add-feature-desc">
                                Toggle off to save this review without displaying it publicly yet.
                            </span>
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        name="isActive"
                        checked={data.isActive}
                        onChange={onChange}
                        style={{ display: 'none' }}
                    />
                    <span className="toggle-slider" />
                </label>

                <button type="submit" className="add-btn" disabled={loading}>
                    {loading ? 'Adding…' : 'Add Testimonial'}
                </button>
            </form>
        </div>
    );
};

export default AddTestimonial;
