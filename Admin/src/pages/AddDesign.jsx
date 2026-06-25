import React, { useState, useRef, useEffect } from 'react';
import '../styles/add.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

// 1. Accept the prop here
const AddDesign = ({ url, setIsLoading, isLoading }) => {
    const [images, setImages] = useState([]);
    const [data, setData] = useState({
        name: "",
        description: "",
        price: "",
        category: "Kitchen Designs",
        isFeatured: false // Add this
    });
    const [points,  setPoints]  = useState([""]);
    const [catOpen, setCatOpen] = useState(false);
    const catRef = useRef(null);

    const token = localStorage.getItem('token');

    useEffect(() => {
        const handleOutside = (e) => {
            if (catRef.current && !catRef.current.contains(e.target)) setCatOpen(false);
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const categories = [
        'Kitchen Designs', 'Bedroom Designs', 'Bathroom Designs',
        'Lounge area Designs', 'Kids Room Designs', 'TV Unit Designs',
        'Commercial Designs', 'Mandir Designs', 'Garden Designs',
        'House Exterior Designs',
    ];

    const onChangeHandler = (event) => {
        const { name, value, type, checked } = event.target;
        setData(prevData => ({
            ...prevData,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const onPointChangeHandler = (index, value) => {
        const updatedPoints = [...points];
        updatedPoints[index] = value;
        setPoints(updatedPoints);
    };

    const addPoint = () => setPoints([...points, ""]);
    const removePoint = (index) => setPoints(points.filter((_, idx) => idx !== index));

    const onImageChangeHandler = (event) => {
        const selectedFiles = Array.from(event.target.files);
        setImages(prevImages => [...prevImages, ...selectedFiles]);
    };

    const removeImage = (indexToRemove) => {
        setImages(images.filter((_, index) => index !== indexToRemove));
    };

    const onSubmitHandler = async (event) => {
        event.preventDefault();
        setIsLoading(true); // 1. Freeze the screen instantly

        const formData = new FormData();
        formData.append("name", data.name);
        formData.append("description", data.description);
        formData.append("category", data.category);
        formData.append("points", JSON.stringify(points));
        formData.append("isFeatured", data.isFeatured);
        images.forEach((image) => {
            formData.append("images", image);
        });

        try {
            const response = await axios.post(`${url}/api/design/add`, formData, { headers: { Authorization: `Bearer ${token}` } });
            if (response.data.success) {
                setData({ name: "", description: "", category: categories[0] });
                setPoints([""]);
                setImages([]);
                toast.success(response.data.message);
            } else {
                toast.error(response.data.message);
            }
        } catch (error) {
            toast.error('An error occurred while adding the data.');
        } finally {
            setIsLoading(false); // 2. Unfreeze the screen
        }
    };

    return (
        <div className='add'>
            <form className="flex-col" onSubmit={onSubmitHandler}>
                <div className="add-img-upload flex-col">
                    <h2>Upload Image</h2>
                    <label htmlFor="image" className="upload-icon">
                        <i className="fa fa-upload"></i>
                    </label>
                    <input onChange={onImageChangeHandler} type='file' id='image' multiple hidden />

                    <div className="selected-images">
                        {images.length > 0 && images.map((img, index) => (
                            <div key={index} className="image-preview">
                                <img src={URL.createObjectURL(img)} alt={`Image ${index + 1}`} className="thumbnail" />
                                <button type="button" onClick={() => removeImage(index)} className="remove-btn">X</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="add-product-name flex-col">
                    <h2>Name</h2>
                    <input onChange={onChangeHandler} value={data.name} type="text" name='name' placeholder='Type here' required />
                </div>

                <div className="add-product-description flex-col">
                    <h2>Description</h2>
                    <textarea onChange={onChangeHandler} value={data.description} name="description" rows="6" placeholder='Write about the item here.' required></textarea>
                </div>

                <div className="add-product-points flex-col">
                    <h2>Points</h2>
                    {points.map((point, index) => (
                        <div key={index} className="point-input">
                            <input
                                type="text"
                                value={point}
                                onChange={(e) => onPointChangeHandler(index, e.target.value)}
                                placeholder={`Point ${index + 1}`}
                            />
                            <button type="button" onClick={() => removePoint(index)} className="remove-point-btn">Remove</button>
                        </div>
                    ))}
                    <button className='add-point-btn' type="button" onClick={addPoint}>+ Add Point</button>
                </div>

                <div className="add-cat-dropdown-wrap flex-col">
                    <h2>Category</h2>
                    <div className="add-cat-dropdown" ref={catRef}>
                        <button
                            type="button"
                            className={`add-cat-trigger${catOpen ? ' open' : ''}`}
                            onClick={() => setCatOpen(o => !o)}
                        >
                            <span>{data.category}</span>
                            <i className="fa fa-chevron-down" />
                        </button>

                        {catOpen && (
                            <ul className="add-cat-list">
                                {categories.map((cat, i) => (
                                    <li
                                        key={i}
                                        className={`add-cat-option${data.category === cat ? ' active' : ''}`}
                                        onClick={() => {
                                            setData(prev => ({ ...prev, category: cat }));
                                            setCatOpen(false);
                                        }}
                                    >
                                        <span>{cat}</span>
                                        {data.category === cat && <i className="fa fa-check" />}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* ── Featured card ── */}
                <label className={`add-feature-card${data.isFeatured ? ' active' : ''}`}>
                    <div className="add-feature-left">
                        <div className="add-feature-icon">
                            <i className="fa fa-star" />
                        </div>
                        <div className="add-feature-text">
                            <span className="add-feature-title">Feature on Homepage</span>
                            <span className="add-feature-desc">
                                Mark as featured — this design will appear in the Featured Picks slider on the design display page.
                            </span>
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        name="isFeatured"
                        checked={data.isFeatured}
                        onChange={onChangeHandler}
                        style={{ display: 'none' }}
                    />
                    <span className="toggle-slider" />
                </label>

                <button type='submit' className='add-btn' disabled={isLoading}>
                    {isLoading ? 'Adding...' : 'Add Design'}
                </button>
            </form>
        </div>
    );
};

export default AddDesign;