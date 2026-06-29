import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import '../styles/list.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';

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
    _id: '', name: '', category: '', description: '', points: [], isFeatured: false
  });
  const [keptImages, setKeptImages] = useState([]);
  const [editImages, setEditImages] = useState([]);

  const [formCategories, setFormCategories] = useState([
    'Kitchen Designs', 'Bedroom Designs', 'Bathroom Designs',
    'Lounge area Designs', 'TV Unit Designs', 'Kids Room Designs',
    'Commercial Designs', 'House Exterior', 'Mandir Designs', 'Garden Designs',
  ]);

  useEffect(() => {
    axios.get(`${url}/api/category/list`)
      .then(res => { if (res.data.success) setFormCategories(res.data.data.map(c => c.name)); })
      .catch(() => {});
  }, [url]);

  const filterCategories = ['All', ...formCategories];

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
    setEditData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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

  const submitEdit = async (e) => {
    e.preventDefault();
    setIsEditModalOpen(false);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("_id", editData._id);
    formData.append("name", editData.name);
    formData.append("description", editData.description);
    formData.append("category", editData.category);
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
                    <option key={index} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

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
                <p>Images (Existing & New)</p>

                <div className="selected-images" style={{ marginBottom: '10px' }}>
                  {keptImages.map((imgUrl, index) => (
                    <div key={`kept-${index}`} className="image-preview">
                      <img src={imgUrl} alt={`Existing ${index}`} className="thumbnail" />
                      <button type="button" onClick={() => removeKeptImage(index)} className="remove-btn">X</button>
                    </div>
                  ))}

                  {editImages.map((img, index) => (
                    <div key={`new-${index}`} className="image-preview">
                      <img src={URL.createObjectURL(img)} alt={`New ${index}`} className="thumbnail" />
                      <button type="button" onClick={() => removeEditImage(index)} className="remove-btn">X</button>
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
              {cat.replace(' Designs', '')} {/* Cleans up long names like 'Kitchen Designs' to just 'Kitchen' */}
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
                  <p className="item-name">{item.name}</p>
                  <p className="item-category">{item.category}</p>

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