import React, { useState } from "react";
import "../styles/add.css";
import { assets } from "../assets/admin_assets/assets";
import axios from "axios";
import { toast } from "react-toastify";
import "../../index.css";

const Add = ({ url }) => {
  const [images, setImages] = useState([]); // Store multiple images
  const [data, setData] = useState({
    name: "",
    description: "",
    price: "",
    category: "Kitchen Designs", // Set a default category
  });

  const [points, setPoints] = useState([""]); // Initialize with one empty point
  const token = localStorage.getItem("token");

  // Hardcoded categories
  const categories = [
    "Kitchen Designs",
    "Bedroom Designs",
    "Bathroom Designs",
    "Lounge area Designs",
    "Home Cinema Designs",
    "TV Unit Designs",
    "Commercial Designs",
    "House Exterior",
    "PVC Louvers",
    "WPC Louvers",
    "Charcoal Louvers",
    "Five G Louvers",
    "Marble sheets",
    "Acrylic Sheets",
    "Flooring",
    "PVC Panels",
    "Projects",
  ];

  const onChangeHandler = (event) => {
    const { name, value } = event.target;
    setData((prevData) => ({ ...prevData, [name]: value }));
  };

  const onPointChangeHandler = (index, value) => {
    const updatedPoints = [...points];
    updatedPoints[index] = value;
    setPoints(updatedPoints);
  };

  const addPoint = () => {
    setPoints([...points, ""]); // Add a new empty point input
  };

  const removePoint = (index) => {
    const updatedPoints = points.filter((_, idx) => idx !== index);
    setPoints(updatedPoints);
  };

  const onImageChangeHandler = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setImages((prevImages) => [...prevImages, ...selectedFiles]); // Add newly selected images to the existing ones
  };

  const removeImage = (indexToRemove) => {
    setImages(images.filter((_, index) => index !== indexToRemove)); // Remove image by index
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();

    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("description", data.description);
    formData.append("category", data.category);
    formData.append("points", JSON.stringify(points)); // Submit points as JSON

    // Append each image file to the FormData object
    images.forEach((image) => {
      formData.append("images", image); // No need for the array format
    });

    try {
      const response = await axios.post(`${url}/api/design/add`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setData({
          name: "",
          description: "",
          category: categories[0], // Reset to the first category
        });
        setPoints([""]); // Reset points
        setImages([]); // Clear the images after successful submission
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error("An error occurred while adding the food item.");
    }
  };

  return (
    <div className="add">
      <form className="flex-col" onSubmit={onSubmitHandler}>
        <div className="add-img-upload flex-col">
          <p>Upload Images</p>
          <label htmlFor="image">
            <img src={assets.upload_area} alt="Upload Area" />
          </label>
          <input
            onChange={onImageChangeHandler}
            type="file"
            id="image"
            multiple
            hidden
          />{" "}
          {/* Allow multiple files */}
          {/* Display thumbnails of all selected images */}
          <div className="selected-images">
            {images.length > 0 &&
              images.map((img, index) => (
                <div key={index} className="image-preview">
                  <img
                    src={URL.createObjectURL(img)}
                    alt={`Image ${index + 1}`}
                    className="thumbnail"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="remove-btn"
                  >
                    X
                  </button>
                </div>
              ))}
          </div>
        </div>
        <div className="add-product-name flex-col">
          <p>Product name</p>
          <input
            onChange={onChangeHandler}
            value={data.name}
            type="text"
            name="name"
            placeholder="Type here"
          />
        </div>
        <div className="add-product-description flex-col">
          <p>Product Description</p>
          <textarea
            onChange={onChangeHandler}
            value={data.description}
            name="description"
            rows="6"
            placeholder="Write about the item here."
          ></textarea>
        </div>

        {/* Points input section */}
        <div className="add-product-points flex-col">
          <p>Points</p>
          {points.map((point, index) => (
            <div key={index} className="point-input">
              <input
                type="text"
                value={point}
                onChange={(e) => onPointChangeHandler(index, e.target.value)}
                placeholder={`Point ${index + 1}`}
              />
              <button type="button" onClick={() => removePoint(index)}>
                Remove
              </button>
            </div>
          ))}
          <button className="add-btn" type="button" onClick={addPoint}>
            Add Point
          </button>
        </div>

        <div className="add-category-price">
          <div className="add-category flex-col">
            <p>Product Category</p>
            <select
              onChange={onChangeHandler}
              name="category"
              value={data.category}
            >
              {categories.map((cat, index) => (
                <option key={index} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="add-btn">
          Add
        </button>
      </form>
    </div>
  );
};

export default Add;
