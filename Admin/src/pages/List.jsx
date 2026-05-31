import React, { useState, useEffect, useRef } from 'react';
import '../styles/list.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';

// 1. Accept the prop here
const List = ({ url, setIsLoading, isLoading }) => {
  const [list, setList] = useState([]);

  // 2. DELETE THIS LINE:
  // const [isLoading, setIsLoading] = useState(false); 

  const token = localStorage.getItem('token');

  // --- NEW: FILTERING STATES ---
  const [currentFilter, setCurrentFilter] = useState('All');
  const mobileBarRef = useRef(null);

  // --- EDIT MODAL STATES ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({ _id: '', name: '', category: '', description: '', points: [] });

  const [keptImages, setKeptImages] = useState([]);
  const [editImages, setEditImages] = useState([]);

  const formCategories = [
    'Kitchen Designs',
    'Bedroom Designs',
    'Bathroom Designs',
    'Lounge area Designs',
    'TV Unit Designs',
    'Kids Room Designs',
    'Commercial Designs',
    'House Exterior',
    'Mandir Designs',
    'Garden Designs',
  ];

  // Added 'All' just for the top filter bar
  const filterCategories = ['All', ...formCategories];

  const fetchList = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${url}/api/design/list`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data.success) {
        setList(response.data.data.reverse()); // Reverse to show newest first
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error("Error fetching list");
    } finally {
      setIsLoading(false);
    }
  }

  const removeFood = async (foodId) => {
    setIsLoading(true);
    try {
      const response = await axios.delete(`${url}/api/design/remove`, {
        data: { _id: foodId },
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
      points: item.points || []
    });
    setKeptImages(item.images || []);
    setEditImages([]);
    setIsEditModalOpen(true);
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
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

  // --- NEW: FILTER LOGIC ---
  const visibleList = currentFilter === 'All'
    ? list
    : list.filter(item => item.category === currentFilter);

  return (
    <div className='list add flex-col'>

      {/* --- EDIT MODAL (UNTOUCHED) --- */}
      {isEditModalOpen && (
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
        </div>
      )}

      {/* --- NEW: EDITORIAL HEADER & FILTER BAR --- */}
      <div className="admin-list-container">

        <div className="admin-header-split">
          <div>
            <h1>Manage Designs</h1>
            <p className="admin-subtitle">Select a category below to filter your database.</p>
          </div>
          <div className="admin-count-badge">
            {visibleList.length} items found
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
            visibleList.map((item, index) => {
              return (
                <div key={index} className="list-table-format row-item">
                  <div className="image-column">
                    {item.images && item.images.length > 0 ? (
                      <img src={item.images[0]} alt="thumbnail" />
                    ) : (
                      <div className="placeholder-img"></div>
                    )}
                  </div>
                  <p className="item-name">{item.name}</p>
                  <p className="item-category">{item.category}</p>

                  <div className="action-buttons">
                    <p onClick={() => openEditModal(item)} className='cursor edit-action'>Edit</p>
                    <p onClick={() => { removeFood(item._id) }} className='cursor delete-action'>X</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  )
}

export default List;