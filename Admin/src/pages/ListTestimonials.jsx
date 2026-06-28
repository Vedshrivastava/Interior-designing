import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment';
import { useWebSocket } from '../hooks/useWebSocket';
import '../styles/list.css';
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
            {editItem && (
                <div className="svc-modal-backdrop" onClick={() => setEditItem(null)}>
                    <div className="svc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="svc-modal-header">
                            <h3 className="svc-modal-title">Edit Testimonial</h3>
                            <button className="svc-modal-close" onClick={() => setEditItem(null)}>✕</button>
                        </div>
                        <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 0 0' }}>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>Name</label>
                                    <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid rgba(201,168,124,0.2)', background: 'rgba(201,168,124,0.04)', fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: 'var(--green)' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>Location</label>
                                    <input value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} required style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid rgba(201,168,124,0.2)', background: 'rgba(201,168,124,0.04)', fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: 'var(--green)' }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>Rating</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[1,2,3,4,5].map(n => (
                                        <button key={n} type="button" onClick={() => setEditForm(p => ({ ...p, rating: n }))} style={{ background: editForm.rating >= n ? '#c9a87c' : 'rgba(201,168,124,0.1)', border: '1px solid rgba(201,168,124,0.3)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: editForm.rating >= n ? '#102525' : '#c9a87c', fontWeight: 700 }}>★</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>Review</label>
                                <textarea value={editForm.text} onChange={e => setEditForm(p => ({ ...p, text: e.target.value }))} rows={4} required style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid rgba(201,168,124,0.2)', background: 'rgba(201,168,124,0.04)', fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: 'var(--green)', resize: 'vertical' }} />
                            </div>
                            <div>
                                <label style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>Replace Photo <span style={{ opacity: 0.5 }}>(optional)</span></label>
                                <input type="file" accept="image/*" onChange={e => setEditForm(p => ({ ...p, image: e.target.files[0] }))} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.82rem' }} />
                            </div>
                            <button type="submit" disabled={saving} style={{ padding: '12px', background: 'linear-gradient(135deg, #c9a87c, #e8c99a)', color: '#102525', border: 'none', borderRadius: 10, fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
                                {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ListTestimonials;
