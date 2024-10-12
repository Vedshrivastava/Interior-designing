import React from 'react'
import '../styles/list.css'
import { useState } from 'react'
import axios from 'axios';
import { toast } from 'react-toastify';
import { useEffect } from 'react';
import '../index.css'

const List = ({ url }) => {

  const [list, setList] = useState([]);
  const token = localStorage.getItem('token');

  const fetchList = async () => {
    const response = await axios.get(`${url}/api/design/list`, { headers: { Authorization: `Bearer ${token}` } });
    if (response.data.success) {
      setList(response.data.data);
    } else {
      toast.error(response.error);
    }
  }

  const removeFood = async (foodId) => {
    try {
      const response = await axios.delete(`${url}/api/design/remove`, {
        data: { _id: foodId },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        await fetchList();
      } else {
        toast.error(response.data.message || "Failed to remove food");
      }
    } catch (error) {
      toast.error("An error occurred while removing the food");
    }
  }

  useEffect(() => {
    fetchList()
  }, [])

  return (
    <div className='list add flex-col'>
      <p>All food list</p>
      <div className="list-table">
        <div className="list-table-format title">
          <b>Image</b>
          <b>Name</b>
          <b>Category</b>
          <b>Action</b>
        </div>
        {list.map((item, index) => {
          return (
            <div key={index} className="list-table-format">
              {/* Images column */}
              <div className="image-column">
                {item.images.map((imageUrl, imgIndex) => (
                  <img key={imgIndex} src={imageUrl} alt={`Image ${imgIndex}`} />
                ))}
              </div>
              {/* Other columns */}
              <p>{item.name}</p>
              <p>{item.category}</p>
              <p onClick={() => { removeFood(item._id) }} className='cursor'>X</p>
            </div>
          );
        })}
      </div>
    </div>

  )
}

export default List