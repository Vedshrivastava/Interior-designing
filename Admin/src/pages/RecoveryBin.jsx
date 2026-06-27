import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
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
                        <b>When</b>
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
                                        ? <img src={item.images[0]} alt={item.name} className="bin-thumb" />
                                        : <div className="placeholder-img bin-thumb-placeholder" />
                                    }
                                </div>

                                {/* Name + type badge */}
                                <div style={{ minWidth: 0 }}>
                                    <p className="item-name bin-item-name">{item.name}</p>
                                    <span className="bin-type-badge">{TYPE_LABEL[item._type] || item._type}</span>
                                </div>

                                {/* Category */}
                                <span className="item-category">
                                    {Array.isArray(item.categories) && item.categories.length
                                        ? item.categories.join(', ')
                                        : item.category || '—'}
                                </span>

                                {/* Deleted by */}
                                <div style={{ minWidth: 0 }}>
                                    <p className="bin-meta-label">Deleted by</p>
                                    <p className="bin-meta-value">{item.deletedBy || '—'}</p>
                                </div>

                                {/* Deleted on */}
                                <div style={{ minWidth: 0 }}>
                                    <p className="bin-meta-label">When</p>
                                    <p
                                        className="bin-meta-value"
                                        title={item.deletedAt ? moment(item.deletedAt).format('DD MMM YYYY, HH:mm') : ''}
                                    >
                                        {item.deletedAt ? moment(item.deletedAt).fromNow() : '—'}
                                    </p>
                                </div>

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

            {/* Custom permanent-delete confirmation modal — portal ensures correct viewport positioning */}
            {confirmItem && ReactDOM.createPortal(
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
                </div>,
                document.body
            )}

            <style>{`
                .bin-grid {
                    grid-template-columns: 96px 1.6fr 1fr 1fr 1fr 190px !important;
                    gap: 24px !important;
                    padding: 16px 28px !important;
                    align-items: center !important;
                }
                @media (max-width: 900px) {
                    .bin-grid { grid-template-columns: 64px 1fr auto !important; gap: 16px !important; padding: 14px 18px !important; }
                }

                /* Thumbnail — greyed-out deleted treatment */
                .bin-thumb {
                    width: 76px;
                    height: 76px;
                    object-fit: cover;
                    border-radius: 10px;
                    border: 1px solid var(--gold-line, rgba(201,168,124,0.25));
                    opacity: 0.6;
                    filter: grayscale(50%);
                    transition: opacity 0.2s, filter 0.2s;
                    display: block;
                }
                .list-table-format.row-item:hover .bin-thumb {
                    opacity: 0.8;
                    filter: grayscale(20%);
                }
                .bin-thumb-placeholder {
                    width: 76px !important;
                    height: 76px !important;
                }

                /* Name — less washed out, truncate if needed */
                .bin-item-name {
                    opacity: 0.85 !important;
                    margin: 0 0 5px 0 !important;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* Type badge — small pill under the name */
                .bin-type-badge {
                    display: inline-block;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 0.62rem;
                    font-weight: 700;
                    letter-spacing: 1.2px;
                    text-transform: uppercase;
                    color: var(--gold, #c9a87c);
                    background: rgba(201,168,124,0.1);
                    border: 1px solid rgba(201,168,124,0.25);
                    border-radius: 20px;
                    padding: 2px 9px;
                }

                /* Deleted by / When — two-line cells */
                .bin-meta-label {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 0.6rem;
                    font-weight: 700;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                    color: var(--text-lt, #9a8e84);
                    margin: 0 0 3px 0;
                }
                .bin-meta-value {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 0.82rem;
                    font-weight: 500;
                    color: var(--text-mid, #5a4e44);
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* Permanent-delete confirmation modal */
                .bin-confirm-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(10, 20, 20, 0.85);
                    z-index: 99999;
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
                    min-width: 160px;
                    justify-content: center;
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
                    min-width: 175px;
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
