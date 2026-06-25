import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment';
import '../styles/list.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const TYPE_LABEL = { design: 'Design', product: 'Product', project: 'Project' };

const RecoveryBin = ({ url }) => {
    const [bin,       setBin]       = useState({ designs: [], products: [], projects: [] });
    const [loading,   setLoading]   = useState(true);
    const [activeTab, setActiveTab] = useState('designs');
    const [query,     setQuery]     = useState('');
    const token = localStorage.getItem('token');

    const fetchBin = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/recovery/bin`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) setBin(res.data.data);
            else toast.error('Failed to load recovery bin.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load recovery bin.');
        } finally {
            setLoading(false);
        }
    }, [url, token]);

    useEffect(() => { fetchBin(); }, [fetchBin]);

    useWebSocket(useCallback((msg) => {
        if (['binChanged', 'designsChanged', 'productsChanged', 'projectsChanged'].includes(msg.type)) {
            fetchBin();
        }
    }, [fetchBin]));

    const restore = async (item) => {
        try {
            const res = await axios.post(
                `${url}/api/recovery/restore`,
                { _id: item._id, _type: item._type },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) { toast.success(res.data.message); fetchBin(); }
            else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to restore.');
        }
    };

    const permanentDelete = async (item) => {
        if (!window.confirm(`Permanently delete "${item.name}"? This cannot be undone and will also delete its images.`)) return;
        try {
            const res = await axios.delete(`${url}/api/recovery/permanent`, {
                data: { _id: item._id, _type: item._type },
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) { toast.success(res.data.message); fetchBin(); }
            else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to permanently delete.');
        }
    };

    const tabs = [
        { key: 'designs',  label: `Designs (${bin.designs.length})`   },
        { key: 'products', label: `Products (${bin.products.length})`  },
        { key: 'projects', label: `Projects (${bin.projects.length})`  },
    ];

    const total = bin.designs.length + bin.products.length + bin.projects.length;
    const items = (bin[activeTab] || [])
        .filter(item => !query || item.name.toLowerCase().includes(query.toLowerCase()));

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">

                <div className="admin-header-split">
                    <div>
                        <h1>Recovery Bin</h1>
                        <p className="admin-subtitle">
                            Restore deleted items or permanently remove them. Only you (Master) can see this.
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div className="admin-search-wrap">
                            <i className="fa-solid fa-magnifying-glass" />
                            <input
                                type="text"
                                placeholder="Search by name…"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                            {query && <button className="admin-search-clear" onClick={() => setQuery('')}>×</button>}
                        </div>
                        <div className="admin-count-badge">{total} item{total !== 1 ? 's' : ''}</div>
                    </div>
                </div>

                {/* Tab switcher */}
                <div className="admin-category-scroll">
                    {tabs.map(({ key, label }) => (
                        <button
                            key={key}
                            className={`admin-cat-pill${activeTab === key ? ' active' : ''}`}
                            onClick={() => setActiveTab(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="list-table">
                    <div className="list-table-format title bin-grid">
                        <b>Image</b>
                        <b>Name</b>
                        <b>Category</b>
                        <b>Deleted By</b>
                        <b>Deleted On</b>
                        <b>Actions</b>
                    </div>

                    {loading ? (
                        <div className="admin-empty-state">Loading…</div>
                    ) : items.length === 0 ? (
                        <div className="admin-empty-state">
                            Nothing in {TYPE_LABEL[activeTab.slice(0, -1)]} bin — all clear.
                        </div>
                    ) : (
                        items.map((item) => (
                            <div key={item._id} className="list-table-format row-item bin-grid">

                                {/* Thumbnail */}
                                <div className="image-column">
                                    {item.images?.[0]
                                        ? <img src={item.images[0]} alt={item.name} className="thumbnail" style={{ opacity: 0.65, filter: 'grayscale(40%)' }} />
                                        : <div className="placeholder-img" />
                                    }
                                </div>

                                {/* Name */}
                                <p className="item-name" style={{ opacity: 0.7 }}>{item.name}</p>

                                {/* Category */}
                                <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.8rem', color: 'var(--text-mid)', margin: 0 }}>
                                    {Array.isArray(item.categories) && item.categories.length
                                        ? item.categories.join(', ')
                                        : item.category || '—'}
                                </p>

                                {/* Deleted by */}
                                <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-lt)', margin: 0 }}>
                                    {item.deletedBy || '—'}
                                </p>

                                {/* Deleted on */}
                                <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-lt)', margin: 0 }}>
                                    {item.deletedAt ? moment(item.deletedAt).format('DD MMM YYYY, HH:mm') : '—'}
                                </p>

                                {/* Actions */}
                                <div className="action-buttons">
                                    <p
                                        className="cursor edit-action"
                                        style={{ color: '#16a34a', borderColor: 'rgba(34,197,94,0.3)' }}
                                        onClick={() => restore(item)}
                                    >
                                        Restore
                                    </p>
                                    <p
                                        className="cursor delete-action"
                                        onClick={() => permanentDelete(item)}
                                        title="This cannot be undone"
                                    >
                                        Delete Forever
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <style>{`
                .bin-grid {
                    grid-template-columns: 72px 1.6fr 1fr 0.9fr 1.1fr 180px !important;
                }
                @media (max-width: 900px) {
                    .bin-grid { grid-template-columns: 56px 1fr auto !important; }
                }
            `}</style>
        </div>
    );
};

export default RecoveryBin;
