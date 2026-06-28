import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../styles/add.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const AddTestimonial = ({ url }) => {
    const [form, setForm] = useState({
        name: '', location: '', text: '', rating: 5, isActive: true,
    });
    const [image, setImage]   = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const token = localStorage.getItem('token');

    const onChange = e => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const onImage = e => {
        const file = e.target.files[0];
        if (!file) return;
        setImage(file);
        setPreview(URL.createObjectURL(file));
    };

    const onSubmit = async e => {
        e.preventDefault();
        if (!form.name || !form.location || !form.text) {
            toast.error('Name, location and review text are required.');
            return;
        }
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('name',     form.name);
            fd.append('location', form.location);
            fd.append('text',     form.text);
            fd.append('rating',   form.rating);
            fd.append('isActive', form.isActive);
            if (image) fd.append('image', image);

            const res = await axios.post(`${url}/api/testimonial/add`, fd, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                toast.success('Testimonial added successfully!');
                setForm({ name: '', location: '', text: '', rating: 5, isActive: true });
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
        <div className="add flex-col">
            <div className="add-form-card">
                <div className="add-form-header">
                    <div>
                        <h1>Add Testimonial</h1>
                        <p className="add-form-subtitle">Add a client review to display on the website.</p>
                    </div>
                </div>

                <form onSubmit={onSubmit} className="add-form-body">

                    {/* Client photo (optional) */}
                    <div className="add-section">
                        <p className="add-section-label">Client Photo <span className="add-optional">(optional)</span></p>
                        <label className="add-img-upload-label" htmlFor="testimonial-img">
                            {preview
                                ? <img src={preview} alt="preview" className="add-img-preview-single" />
                                : <div className="add-img-placeholder"><i className="fa-regular fa-image" /><span>Upload Photo</span></div>
                            }
                        </label>
                        <input id="testimonial-img" type="file" accept="image/*" onChange={onImage} hidden />
                    </div>

                    {/* Name + Location */}
                    <div className="add-section add-row">
                        <div className="add-field">
                            <label>Client Name <span className="add-required">*</span></label>
                            <input name="name" type="text" placeholder="e.g. Rahul Mehta" value={form.name} onChange={onChange} required />
                        </div>
                        <div className="add-field">
                            <label>Location <span className="add-required">*</span></label>
                            <input name="location" type="text" placeholder="e.g. Mumbai" value={form.location} onChange={onChange} required />
                        </div>
                    </div>

                    {/* Rating */}
                    <div className="add-section">
                        <label>Star Rating <span className="add-required">*</span></label>
                        <div className="add-star-row">
                            {[1,2,3,4,5].map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    className={`add-star-btn${form.rating >= n ? ' active' : ''}`}
                                    onClick={() => setForm(prev => ({ ...prev, rating: n }))}
                                >
                                    <i className="fa-solid fa-star" />
                                </button>
                            ))}
                            <span className="add-star-label">{form.rating} / 5</span>
                        </div>
                    </div>

                    {/* Review Text */}
                    <div className="add-section">
                        <label>Review <span className="add-required">*</span></label>
                        <textarea
                            name="text"
                            rows={5}
                            placeholder="Write the client's review here…"
                            value={form.text}
                            onChange={onChange}
                            required
                        />
                    </div>

                    {/* Active toggle */}
                    <div className="add-section add-toggle-row">
                        <div className="add-toggle-info">
                            <p className="add-toggle-title">Show on Website</p>
                            <p className="add-toggle-sub">Toggle off to hide this review without deleting it.</p>
                        </div>
                        <label className="add-toggle-switch">
                            <input type="checkbox" name="isActive" checked={form.isActive} onChange={onChange} />
                            <span className="add-toggle-track"><span className="add-toggle-thumb" /></span>
                        </label>
                    </div>

                    <button type="submit" className="add-submit-btn" disabled={loading}>
                        {loading ? <><i className="fa-solid fa-circle-notch fa-spin" /> Saving…</> : 'Add Testimonial'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddTestimonial;
