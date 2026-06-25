import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment';
import '../styles/list.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const TYPE_LABEL = { design: 'Design', product: 'Product', project: 'Project' };

const RecoveryBin = ({ url }) => {
    const [bin,          setBin]          = useState({ designs: [], products: [], projects: [] });
    const [loading,      setLoading]      = useState(true);
    const [activeTab,    setActiveTab]    = useState('designs');
    const [query,        setQuery]        = useState('');
    const [confirmItem,  setConfirmItem]  = useState(null);   // item pending permanent delete
    const [deleting,     setDeleting]     = useState(false);  // lock while API call is in-flight
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

    const confirmPermanentDelete = (item) => {
        setConfirmItem(item);
    };

    const permanentDelete = async () => {
        if (!confirmItem || deleting) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/recovery/permanent`, {
                data: { _id: confirmItem._id, _type: confirmItem._type },
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) { toast.success(res.data.message); fetchBin(); }
            else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to permanently delete.');
        } finally {
            setDeleting(false);
            setConfirmItem(null);
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
                                        onClick={() => confirmPermanentDelete(item)}
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

            {/* Custom permanent-delete confirmation modal */}
            {confirmItem && (
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon">
                            <i className="fa-solid fa-triangle-exclamation" />
                        </div>
                        <h3>Delete Forever?</h3>
                        <p className="bin-confirm-name">"{confirmItem.name}"</p>
                        <p className="bin-confirm-warning">
                            This will permanently remove the item and all its images from storage.<br />
                            <strong>This action cannot be undone.</strong>
                        </p>
                        <div className="bin-confirm-actions">
                            <button
                                className="bin-btn-cancel"
                                onClick={() => setConfirmItem(null)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="bin-btn-delete"
                                onClick={permanentDelete}
                                disabled={deleting}
                            >
                                {deleting
                                    ? <><i className="fa-solid fa-circle-notch fa-spin" /> Deleting…</>
                                    : <><i className="fa-solid fa-trash" /> Yes, Delete Forever</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .bin-grid {
                    grid-template-columns: 72px 1.6fr 1fr 0.9fr 1.1fr 180px !important;
                }
                @media (max-width: 900px) {
                    .bin-grid { grid-template-columns: 56px 1fr auto !important; }
                }

                /* Permanent-delete confirmation modal */
                .bin-confirm-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(10, 20, 20, 0.55);
                    backdrop-filter: blur(3px);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: binFadeIn 0.15s ease;
                }
                @keyframes binFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                .bin-confirm-modal {
                    background: var(--ivory);
                    border: 1px solid var(--gold-line, rgba(201,168,124,0.35));
                    border-radius: 14px;
                    padding: 36px 32px 28px;
                    width: min(420px, 92vw);
                    text-align: center;
                    box-shadow: 0 20px 60px rgba(10,20,20,0.25);
                    animation: binSlideUp 0.18s ease;
                }
                @keyframes binSlideUp {
                    from { transform: translateY(14px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
                .bin-confirm-icon {
                    width: 52px;
                    height: 52px;
                    border-radius: 50%;
                    background: rgba(220, 60, 60, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 16px;
                    font-size: 1.4rem;
                    color: #c0392b;
                }
                .bin-confirm-modal h3 {
                    font-family: 'Cormorant Garamond', serif;
                    font-size: 1.4rem;
                    font-weight: 600;
                    color: var(--green);
                    margin: 0 0 6px;
                }
                .bin-confirm-name {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: var(--gold, #c9a87c);
                    margin: 0 0 14px;
                    word-break: break-word;
                }
                .bin-confirm-warning {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 0.85rem;
                    color: var(--text-mid, #5a6a6a);
                    line-height: 1.6;
                    margin: 0 0 26px;
                }
                .bin-confirm-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                }
                .bin-btn-cancel,
                .bin-btn-delete {
                    padding: 10px 22px;
                    border-radius: 8px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 0.88rem;
                    font-weight: 500;
                    cursor: pointer;
                    border: 1px solid;
                    transition: background 0.15s, opacity 0.15s;
                    display: flex;
                    align-items: center;
                    gap: 7px;
                }
                .bin-btn-cancel {
                    background: transparent;
                    border-color: var(--gold-line, rgba(201,168,124,0.4));
                    color: var(--green);
                }
                .bin-btn-cancel:hover:not(:disabled) {
                    background: rgba(201,168,124,0.1);
                }
                .bin-btn-delete {
                    background: #c0392b;
                    border-color: #c0392b;
                    color: #fff;
                }
                .bin-btn-delete:hover:not(:disabled) {
                    background: #a93226;
                    border-color: #a93226;
                }
                .bin-btn-cancel:disabled,
                .bin-btn-delete:disabled {
                    opacity: 0.55;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
};

export default RecoveryBin;
