import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment';
import { useWebSocket } from '../hooks/useWebSocket';
import '../styles/list.css';
import '../styles/add.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const STARS = n => '★'.repeat(n) + '☆'.repeat(5 - n);

const ListTestimonials = ({ url }) => {
    const [testimonials, setTestimonials] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [query, setQuery]               = useState('');
    const [editItem, setEditItem]         = useState(null);
    const [editForm, setEditForm]         = useState({});
    const [saving, setSaving]             = useState(false);
    const token = localStorage.getItem('token');

    const fetchTestimonials = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/testimonial/list`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) setTestimonials(res.data.data);
            else toast.error('Failed to load testimonials.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load testimonials.');
        } finally {
            setLoading(false);
        }
    }, [url, token]);

    useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);

    useWebSocket(useCallback(msg => {
        if (msg.type === 'testimonialsChanged') fetchTestimonials();
    }, [fetchTestimonials]));

    const removeTestimonial = async (id) => {
        if (!window.confirm('Move this testimonial to the recovery bin?')) return;
        try {
            const res = await axios.delete(`${url}/api/testimonial/remove`, {
                data: { id },
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) { toast.success(res.data.message); fetchTestimonials(); }
            else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to remove.');
        }
    };

    const toggleActive = async (item) => {
        try {
            const res = await axios.post(`${url}/api/testimonial/update`,
                { id: item._id, isActive: String(!item.isActive) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) { fetchTestimonials(); toast.success(item.isActive ? 'Hidden from website.' : 'Now showing on website.'); }
            else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update.');
        }
    };

    const openEdit = (item) => {
        setEditItem(item);
        setEditForm({ name: item.name, location: item.location, text: item.text, rating: item.rating });
    };

    const saveEdit = async e => {
        e.preventDefault();
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('id',       editItem._id);
            fd.append('name',     editForm.name);
            fd.append('location', editForm.location);
            fd.append('text',     editForm.text);
            fd.append('rating',   editForm.rating);
            if (editForm.image) fd.append('image', editForm.image);

            const res = await axios.post(`${url}/api/testimonial/update`, fd, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                toast.success('Testimonial updated!');
                setEditItem(null);
                fetchTestimonials();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update.');
        } finally {
            setSaving(false);
        }
    };

    const visible = testimonials.filter(t =>
        !query || t.name.toLowerCase().includes(query.toLowerCase()) || t.location.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">

                <div className="admin-header-split">
                    <div>
                        <h1>Testimonials</h1>
                        <p className="admin-subtitle">Manage client reviews shown on the website.</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div className="admin-search-wrap">
                            <i className="fa-solid fa-magnifying-glass" />
                            <input
                                type="text"
                                placeholder="Search by name or location…"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                            {query && <button className="admin-search-clear" onClick={() => setQuery('')}>×</button>}
                        </div>
                        <div className="admin-count-badge">{testimonials.length} review{testimonials.length !== 1 ? 's' : ''}</div>
                    </div>
                </div>

                <div className="list-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '72px 1.2fr 0.8fr 0.6fr 0.8fr 160px' }}>
                        <b>Photo</b><b>Client</b><b>Location</b><b>Rating</b><b>Status</b><b>Actions</b>
                    </div>

                    {loading ? (
                        <div className="admin-empty-state">Loading…</div>
                    ) : visible.length === 0 ? (
                        <div className="admin-empty-state">No testimonials found.</div>
                    ) : (
                        visible.map(t => (
                            <div key={t._id} className="list-table-format row-item" style={{ gridTemplateColumns: '72px 1.2fr 0.8fr 0.6fr 0.8fr 160px', alignItems: 'center' }}>

                                <div className="image-column">
                                    {t.image
                                        ? <img src={t.image} alt={t.name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(201,168,124,0.3)' }} />
                                        : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(201,168,124,0.12)', border: '1.5px solid rgba(201,168,124,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair Display, serif', fontWeight: 700, color: '#c9a87c', fontSize: '1.1rem' }}>{t.name.charAt(0)}</div>
                                    }
                                </div>

                                <div style={{ minWidth: 0 }}>
                                    <p className="item-name" style={{ marginBottom: 4 }}>{t.name}</p>
                                    <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: 'var(--text-lt)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</p>
                                </div>

                                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.82rem', color: 'var(--text-mid)' }}>{t.location}</span>

                                <span style={{ color: '#c9a87c', fontSize: '0.78rem', letterSpacing: 1 }}>{STARS(t.rating)}</span>

                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', padding: '4px 10px',
                                    borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px',
                                    textTransform: 'uppercase', width: 'fit-content', alignSelf: 'center',
                                    background: t.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
                                    border: `1px solid ${t.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
                                    color: t.isActive ? '#15803d' : '#dc2626',
                                }}>
                                    {t.isActive ? 'Active' : 'Hidden'}
                                </span>

                                <div className="action-buttons">
                                    <p className="cursor edit-action" onClick={() => openEdit(t)}>Edit</p>
                                    <p className="cursor" style={{ color: t.isActive ? '#b45309' : '#16a34a', borderColor: t.isActive ? 'rgba(180,83,9,0.3)' : 'rgba(22,163,74,0.3)', fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', fontWeight: 600, padding: '5px 10px', border: '1px solid', borderRadius: 6, cursor: 'pointer', margin: 0 }} onClick={() => toggleActive(t)}>
                                        {t.isActive ? 'Hide' : 'Show'}
                                    </p>
                                    <p className="cursor delete-action" onClick={() => removeTestimonial(t._id)}>Delete</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Edit modal */}
            {editItem && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Edit Testimonial</h2>
                        <form className="flex-col" onSubmit={saveEdit}>

                            <div className="add-product-name flex-col">
                                <p>Client Name</p>
                                <input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required />
                            </div>

                            <div className="add-product-name flex-col">
                                <p>Location</p>
                                <input type="text" value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} required />
                            </div>

                            <div className="add-product-points flex-col">
                                <p>Star Rating</p>
                                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                    {[1,2,3,4,5].map(n => (
                                        <button
                                            key={n} type="button"
                                            onClick={() => setEditForm(p => ({ ...p, rating: n }))}
                                            style={{
                                                background: editForm.rating >= n ? 'rgba(201,168,124,0.25)' : 'rgba(201,168,124,0.06)',
                                                border: `1.5px solid ${editForm.rating >= n ? 'rgba(201,168,124,0.6)' : 'rgba(201,168,124,0.2)'}`,
                                                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                                                color: editForm.rating >= n ? '#c9a87c' : 'rgba(201,168,124,0.4)',
                                                fontSize: '1rem', fontWeight: 700,
                                            }}
                                        >★</button>
                                    ))}
                                    <span style={{ alignSelf: 'center', color: '#c9a87c', fontWeight: 600, fontSize: '0.85rem' }}>{editForm.rating} / 5</span>
                                </div>
                            </div>

                            <div className="add-product-description flex-col">
                                <p>Review</p>
                                <textarea rows={4} value={editForm.text} onChange={e => setEditForm(p => ({ ...p, text: e.target.value }))} required />
                            </div>

                            <div className="add-img-upload flex-col">
                                <p>Replace Photo <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.8rem' }}>(optional)</span></p>
                                <label htmlFor="edit-t-img" className="upload-icon">
                                    <i className="fa fa-upload" />
                                </label>
                                <input id="edit-t-img" type="file" accept="image/*" onChange={e => setEditForm(p => ({ ...p, image: e.target.files[0] }))} hidden />
                                {editForm.image && <p style={{ fontSize: '0.78rem', color: '#c9a87c', marginTop: 6 }}>New photo selected: {editForm.image.name}</p>}
                            </div>

                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={() => setEditItem(null)}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={saving}>
                                    {saving ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ListTestimonials;
