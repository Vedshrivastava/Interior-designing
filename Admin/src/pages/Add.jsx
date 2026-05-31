import React, { useState } from 'react';
import '../styles/add.css';
import { assets } from '../assets/admin_assets/assets';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

// 1. Accept the prop here
const Add = ({ url, setIsLoading, isLoading }) => {
    const [images, setImages] = useState([]); 
    const [data, setData] = useState({
        name: "",
        description: "",
        price: "",
        category: "Kitchen Designs" 
    });
    const [points, setPoints] = useState([""]); 
    
    // 2. DELETE THIS LINE:
    // const [isLoading, setIsLoading] = useState(false); 
    
    const token = localStorage.getItem('token');

    const categories = [
        'Kitchen Designs', 'Bedroom Designs', 'Bathroom Designs', 
        'Lounge area Designs', 'Kids Room Designs', 'TV Unit Designs', 
        'Commercial Designs', 'Mandir Designs', 'Garden Designs', 
        'House Exterior Designs', 'PVC Louvers', 'WPC Louvers', 
        'Charcoal Louvers', 'Five G Louvers', 'Marble sheets', 
        'Acrylic Sheets', 'Flooring', 'PVC Panels', 'Projects'
    ];

    const onChangeHandler = (event) => {
        const { name, value } = event.target;
        setData(prevData => ({ ...prevData, [name]: value }));
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

                <div className="add-category-price">
                    <div className="add-category flex-col">
                        <h2>Category</h2>
                        <select onChange={onChangeHandler} name="category" value={data.category}>
                            {categories.map((cat, index) => (
                                <option key={index} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button type='submit' className='add-btn' disabled={isLoading}>
                    {isLoading ? 'Adding...' : 'Add Design'}
                </button>
            </form>
        </div>
    );
};

export default Add;