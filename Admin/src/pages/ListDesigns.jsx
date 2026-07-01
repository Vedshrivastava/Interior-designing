import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import '../styles/list.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { iconifyImgUrl } from '../components/IconTagManager';

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
  textDecoration: 'none',
  flexShrink: 0,
});

const ChevronIcon = ({ dir }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {dir === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
  </svg>
);

const DownloadIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><path d="M5 19h14" />
  </svg>
);

// 1. Accept the prop here
const ListDesigns = ({ url, setIsLoading, isLoading }) => {
  const [list, setList] = useState([]);

  // 2. DELETE THIS LINE:
  // const [isLoading, setIsLoading] = useState(false); 

  const token = localStorage.getItem('token');

  // --- NEW: FILTERING STATES ---
  const [currentFilter, setCurrentFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const mobileBarRef = useRef(null);

  // --- LIGHTBOX STATES ---
  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0, name: '' });

  const openLightbox = (images, index, name) => {
    setLightbox({ open: true, images, index, name });
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = useCallback(() => {
    setLightbox({ open: false, images: [], index: 0, name: '' });
    document.body.style.overflow = '';
  }, []);

  const lbGoPrev = useCallback((e) => {
    e.stopPropagation();
    setLightbox(prev => ({ ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length }));
  }, []);

  const lbGoNext = useCallback((e) => {
    e.stopPropagation();
    setLightbox(prev => ({ ...prev, index: (prev.index + 1) % prev.images.length }));
  }, []);

  useEffect(() => {
    if (!lightbox.open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') setLightbox(prev => ({ ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length }));
      if (e.key === 'ArrowRight') setLightbox(prev => ({ ...prev, index: (prev.index + 1) % prev.images.length }));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightbox.open, closeLightbox]);

  // --- EDIT MODAL STATES ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({
    _id: '', name: '', category: '', subcategories: [], description: '', points: [], isFeatured: false
  });
  const [keptImages, setKeptImages] = useState([]);
  const [editImages, setEditImages] = useState([]);

  const [subcategoryObjects, setSubcategoryObjects] = useState([]);
  const [editSubCatOpen, setEditSubCatOpen] = useState(false);
  const editSubCatRef = useRef(null);

  useEffect(() => {
    axios.get(`${url}/api/design-subcategory/list`)
      .then(res => { if (res.data.success) setSubcategoryObjects(res.data.data); })
      .catch(() => {});
  }, [url]);

  useEffect(() => {
    const handler = (e) => {
      if (editSubCatRef.current && !editSubCatRef.current.contains(e.target)) setEditSubCatOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const editAvailableSubcats = editData.category
    ? subcategoryObjects.filter(s => s.categories?.includes(editData.category))
    : [];

  const [formCategories, setFormCategories] = useState([
    { name: 'Kitchen Designs',     label: 'Kitchen'    },
    { name: 'Bedroom Designs',     label: 'Bedroom'    },
    { name: 'Bathroom Designs',    label: 'Bathroom'   },
    { name: 'Lounge area Designs', label: 'Lounge'     },
    { name: 'TV Unit Designs',     label: 'TV Unit'    },
    { name: 'Kids Room Designs',   label: 'Kids Room'  },
    { name: 'Commercial Designs',  label: 'Commercial' },
    { name: 'House Exterior',      label: 'Exterior'   },
    { name: 'Mandir Designs',      label: 'Mandir'     },
    { name: 'Garden Designs',      label: 'Garden'     },
  ]);

  useEffect(() => {
    axios.get(`${url}/api/category/list`)
      .then(res => { if (res.data.success) setFormCategories(res.data.data); })
      .catch(() => {});
  }, [url]);

  const getCatLabel = (name) => formCategories.find(c => c.name === name)?.label || name;
  const filterCategories = ['All', ...formCategories.map(c => c.name)];

  const fetchList = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${url}/api/design/list`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data.success) {
        setList([...response.data.data]);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error("Error fetching list");
    } finally {
      setIsLoading(false);
    }
  }

  const removeDesign = async (designId) => {
    setIsLoading(true);
    try {
      const response = await axios.delete(`${url}/api/design/remove`, {
        data: { _id: designId },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        toast.success("Design Removed");
        await fetchList();
      } else {
        toast.error(response.data.message || "Failed to remove item");
      }
    } catch (error) {
      toast.error("An error occurred while removing the item");
    } finally {
      setIsLoading(false);
    }
  }

  // --- EDIT FUNCTIONS (UNTOUCHED) ---
  const openEditModal = (item) => {
    setEditData({
      _id: item._id,
      name: item.name,
      category: item.category,
      subcategories: item.subcategories || [],
      description: item.description,
      points: item.points || [],
      isFeatured: item.isFeatured || false // Add this
    });
    setKeptImages(item.images || []);
    setEditImages([]);
    setIsEditModalOpen(true);
  }

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'category') {
      const validSubNames = subcategoryObjects.filter(s => s.categories?.includes(value)).map(s => s.name);
      setEditData(prev => ({ ...prev, category: value, subcategories: prev.subcategories.filter(s => validSubNames.includes(s)) }));
      return;
    }
    setEditData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  const toggleEditSubcategory = (name) => {
    setEditData(prev => ({
      ...prev,
      subcategories: prev.subcategories.includes(name)
        ? prev.subcategories.filter(s => s !== name)
        : [...prev.subcategories, name],
    }));
  }

  const handleEditPointChange = (index, value) => {
    const newPoints = [...editData.points];
    newPoints[index] = value;
    setEditData(prev => ({ ...prev, points: newPoints }));
  }

  const addEditPoint = () => setEditData(prev => ({ ...prev, points: [...prev.points, ""] }));

  const removeEditPoint = (index) => {
    const newPoints = editData.points.filter((_, idx) => idx !== index);
    setEditData(prev => ({ ...prev, points: newPoints }));
  }

  const handleEditImageChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setEditImages(prev => [...prev, ...selectedFiles]);
  }
  const removeEditImage = (indexToRemove) => {
    setEditImages(editImages.filter((_, idx) => idx !== indexToRemove));
  }

  const removeKeptImage = (indexToRemove) => {
    setKeptImages(keptImages.filter((_, idx) => idx !== indexToRemove));
  }

  const moveKeptImage = (index, direction) => {
    setKeptImages(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const moveEditImage = (index, direction) => {
    setEditImages(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // Cloudinary: inserting fl_attachment forces a real download (with
  // correct headers) instead of the browser navigating to the image.
  const cloudinaryDownloadUrl = (imgUrl) => imgUrl.replace('/upload/', '/upload/fl_attachment/');

  const submitEdit = async (e) => {
    e.preventDefault();
    setIsEditModalOpen(false);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("_id", editData._id);
    formData.append("name", editData.name);
    formData.append("description", editData.description);
    formData.append("category", editData.category);
    formData.append("subcategories", JSON.stringify(editData.subcategories));
    formData.append("points", JSON.stringify(editData.points));
    formData.append("isFeatured", editData.isFeatured);
    formData.append("existingImages", JSON.stringify(keptImages));

    editImages.forEach(img => {
      formData.append("images", img);
    });

    try {
      const response = await axios.post(`${url}/api/design/update`, formData, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data.success) {
        toast.success("Design Updated Successfully");
        await fetchList();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error("Error updating design");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchList()
  }, [])

  const visibleList = list
    .filter(item => currentFilter === 'All' || item.category === currentFilter)
    .filter(item => !query || item.name.toLowerCase().includes(query.toLowerCase()));

  const totalPages   = Math.ceil(visibleList.length / ITEMS_PER_PAGE);
  const paginatedList = visibleList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset to page 1 when filter or query changes
  useEffect(() => { setCurrentPage(1); }, [currentFilter, query]);

  const getPageRange = (cur, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)          return [1, 2, 3, 4, 5, '…', total];
    if (cur >= total - 3)  return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '…', cur - 1, cur, cur + 1, '…', total];
  };

  return (
    <div className='list add flex-col'>

      {/* --- LIGHTBOX PORTAL --- */}
      {lightbox.open && ReactDOM.createPortal(
        <div className="lb-overlay" onClick={closeLightbox}>
          <button className="lb-close" onClick={closeLightbox} aria-label="Close">✕</button>

          {lightbox.images.length > 1 && (
            <button className="lb-arrow lb-arrow--prev" onClick={lbGoPrev} aria-label="Previous">&#8249;</button>
          )}

          <div className="lb-img-wrap" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.images[lightbox.index]}
              alt={`${lightbox.name} — ${lightbox.index + 1}`}
              className="lb-img"
            />
            <div className="lb-caption">
              <span className="lb-name">{lightbox.name}</span>
              {lightbox.images.length > 1 && (
                <span className="lb-counter">{lightbox.index + 1} / {lightbox.images.length}</span>
              )}
            </div>
          </div>

          {lightbox.images.length > 1 && (
            <button className="lb-arrow lb-arrow--next" onClick={lbGoNext} aria-label="Next">&#8250;</button>
          )}
        </div>,
        document.body
      )}

      {/* --- EDIT MODAL (UNTOUCHED) --- */}
      {isEditModalOpen && ReactDOM.createPortal(
        <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
          <div className="loader-modal-box edit-modal">
            <h2>Edit Design</h2>

            <form className="flex-col" onSubmit={submitEdit}>
              <div className="add-product-name flex-col">
                <p>Name</p>
                <input type="text" name="name" value={editData.name} onChange={handleEditChange} required />
              </div>

              <div className="add-product-description flex-col">
                <p>Description</p>
                <textarea name="description" rows="4" value={editData.description} onChange={handleEditChange} required></textarea>
              </div>

              <div className="add-category-price flex-col">
                <p>Category</p>
                <select name="category" value={editData.category} onChange={handleEditChange}>
                  {formCategories.map((cat, index) => (
                    <option key={index} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {editAvailableSubcats.length > 0 && (
                <div className="add-cat-dropdown-wrap flex-col">
                  <p>Subcategories <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#888' }}>(select all that apply)</span></p>
                  <div className="add-cat-dropdown" ref={editSubCatRef}>
                    <button type="button" className={`add-cat-trigger${editSubCatOpen ? ' open' : ''}`} onClick={() => setEditSubCatOpen(o => !o)}>
                      <span>{editData.subcategories.length > 0 ? editData.subcategories.join(', ') : 'Select subcategories'}</span>
                      <i className="fa fa-chevron-down" />
                    </button>
                    {editSubCatOpen && (
                      <ul className="add-cat-list">
                        {editAvailableSubcats.map(sub => {
                          const iconUrl = iconifyImgUrl(sub.icon);
                          const sel = editData.subcategories.includes(sub.name);
                          return (
                            <li key={sub._id} className={`add-cat-option${sel ? ' active' : ''}`}
                              onClick={() => toggleEditSubcategory(sub.name)}>
                              {iconUrl && <img src={iconUrl} width={13} height={13} alt="" style={{ marginRight: '6px' }} />}
                              <span>{sub.name}</span>
                              {sel && <i className="fa fa-check" />}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <div className="add-featured flex-col" style={{ marginTop: '10px' }}>
                <label className="featured-toggle">
                  <input
                    type="checkbox"
                    name="isFeatured"
                    checked={editData.isFeatured}
                    onChange={handleEditChange}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-label">Feature on Homepage</span>
                </label>
              </div>

              <div className="add-product-points flex-col">
                <p>Points</p>
                {editData.points.map((point, index) => (
                  <div key={index} className="point-input">
                    <input type="text" value={point} onChange={(e) => handleEditPointChange(index, e.target.value)} />
                    <button type="button" onClick={() => removeEditPoint(index)} className="remove-point-btn">X</button>
                  </div>
                ))}
                <button type="button" className="add-point-btn" onClick={addEditPoint}>+ Add Point</button>
              </div>

              <div className="add-img-upload flex-col" style={{ marginTop: '10px' }}>
                <p>Images (Existing &amp; New) — number shows display order on the site</p>

                <div className="selected-images" style={{ marginBottom: '10px' }}>
                  {keptImages.map((imgUrl, index) => (
                    <div key={`kept-${index}`} className="image-preview">
                      <span className="img-order-badge">{index + 1}</span>
                      <img src={imgUrl} alt={`Existing ${index}`} className="thumbnail" />
                      <button type="button" onClick={() => removeKeptImage(index)} className="remove-btn">X</button>
                      <div className="image-preview-toolbar">
                        <button type="button" style={imgToolBtnStyle(index === 0)} disabled={index === 0}
                          onClick={() => moveKeptImage(index, -1)} title="Move earlier">
                          <ChevronIcon dir="left" />
                        </button>
                        <a style={imgToolBtnStyle(false)} href={cloudinaryDownloadUrl(imgUrl)} target="_blank" rel="noopener noreferrer" title="Download image">
                          <DownloadIcon />
                        </a>
                        <button type="button" style={imgToolBtnStyle(index === keptImages.length - 1)} disabled={index === keptImages.length - 1}
                          onClick={() => moveKeptImage(index, 1)} title="Move later">
                          <ChevronIcon dir="right" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {editImages.map((img, index) => (
                    <div key={`new-${index}`} className="image-preview">
                      <span className="img-order-badge">{keptImages.length + index + 1}</span>
                      <img src={URL.createObjectURL(img)} alt={`New ${index}`} className="thumbnail" />
                      <button type="button" onClick={() => removeEditImage(index)} className="remove-btn">X</button>
                      <div className="image-preview-toolbar">
                        <button type="button" style={imgToolBtnStyle(index === 0)} disabled={index === 0}
                          onClick={() => moveEditImage(index, -1)} title="Move earlier">
                          <ChevronIcon dir="left" />
                        </button>
                        <a style={imgToolBtnStyle(false)} href={URL.createObjectURL(img)} download={img.name} title="Download image">
                          <DownloadIcon />
                        </a>
                        <button type="button" style={imgToolBtnStyle(index === editImages.length - 1)} disabled={index === editImages.length - 1}
                          onClick={() => moveEditImage(index, 1)} title="Move later">
                          <ChevronIcon dir="right" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <label htmlFor="edit-image" className="upload-icon">
                  <i className="fa fa-upload" style={{ fontSize: '24px', width: '60px', height: '60px' }}></i>
                </label>
                <input onChange={handleEditImageChange} type='file' id='edit-image' multiple hidden />
              </div>

              <div className="edit-modal-actions">
                <button type="button" className="add-btn cancel-btn" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="add-btn" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>                      </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- NEW: EDITORIAL HEADER & FILTER BAR --- */}
      <div className="admin-list-container">

        <div className="admin-header-split">
          <div>
            <h1>Manage Designs</h1>
            <p className="admin-subtitle">Select a category below to filter your database.</p>
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
            <div className="admin-count-badge">{visibleList.length} found</div>
          </div>
        </div>

        <div className="admin-category-scroll" ref={mobileBarRef}>
          {filterCategories.map(cat => (
            <button
              key={cat}
              className={`admin-cat-pill ${currentFilter === cat ? 'active' : ''}`}
              onClick={() => setCurrentFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* --- LIST TABLE --- */}
        <div className="list-table">
          <div className="list-table-format title">
            <b>Image</b>
            <b>Name</b>
            <b>Category</b>
            <b>Action</b>
          </div>

          {visibleList.length === 0 ? (
            <div className="admin-empty-state">
              <p>No designs found in this category.</p>
            </div>
          ) : (
            paginatedList.map((item, index) => {
              return (
                <div key={index} className="list-table-format row-item">
                  <div className="image-column">
                    {item.images && item.images.length > 0 ? (
                      <img
                        src={item.images[0]}
                        alt="thumbnail"
                        className="lb-trigger"
                        onClick={() => openLightbox(item.images, 0, item.name)}
                        title="Click to view images"
                      />
                    ) : (
                      <div className="placeholder-img"></div>
                    )}
                  </div>
                  <div>
                    <p className="item-name">{item.name}</p>
                    {item.subcategories?.length > 0 && (
                      <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-mid)', margin: '4px 0 0' }}>
                        {item.subcategories.join(', ')}
                      </p>
                    )}
                  </div>
                  <p className="item-category">{getCatLabel(item.category)}</p>

                  <div className="action-buttons">
                    <p onClick={() => openEditModal(item)} className='cursor edit-action'>Edit</p>
                    <p onClick={() => { removeDesign(item._id) }} className='cursor delete-action'>X</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="admin-pagination">
            <button className="admin-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
            {getPageRange(currentPage, totalPages).map((p, i) =>
              p === '…'
                ? <span key={`e${i}`} className="admin-page-ellipsis">…</span>
                : <button key={p} className={`admin-page-btn${p === currentPage ? ' active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
            )}
            <button className="admin-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
          </div>
        )}

      </div>
    </div>
  )
}

export default ListDesigns;