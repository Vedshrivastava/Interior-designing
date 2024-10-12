import React, { useEffect, useState } from 'react';
import '../styles/orders.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import { assets } from '../assets/admin_assets/assets';
import moment from 'moment'; // Import moment.js for date formatting

const Orders = ({ url }) => {
  const [orders, setOrders] = useState([]);
  const token = localStorage.getItem('token');

  // Fetch all orders (whether paid or unpaid)
  const fetchAllOrders = async () => {
    try {
      const response = await axios.get(`${url}/api/appointment/list`, { headers: { Authorization: `Bearer ${token}` } });

      if (response.data.success) {
        setOrders(response.data.appointments); // Set the orders if the response is successful
      } else {
        console.log(response);
        toast.error('Error fetching orders'); // Show error if response is not successful
      }
    } catch (error) {
      toast.error('Failed to fetch orders'); // Show general error
      console.error(error); // Log the error for debugging
    }
  };

  // Group orders by date
  const groupOrdersByDate = (orders) => {
    return orders.reduce((groups, order) => {
      const date = moment(order.date).format('YYYY-MM-DD'); // Format the order date
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(order);
      return groups;
    }, {});
  };

  // Update the status of an order
  const statusHandler = async (event, orderId) => {
    const newStatus = event.target.value; // Get the new status from the dropdown

    try {
      // Call API to update the status directly in the backend
      const response = await axios.post(url + '/api/appointment/status', {
        orderId,
        status: newStatus, // Send the new status directly
      });

      if (response.data.success) {
        fetchAllOrders(); // Refresh orders after status update
      } else {
        toast.error('Failed to update order status');
      }
    } catch (error) {
      toast.error('Failed to update order status');
      console.error(error);
    }
  };

  useEffect(() => {
    fetchAllOrders(); // Fetch orders when component mounts
  }, []);

  // Group orders by date
  const groupedOrders = groupOrdersByDate(orders);

  return (
    <div className='order add'>
      <h3>Order Page</h3>
      <div className='order-list'>
        {Object.keys(groupedOrders).map((date) => (
          <div key={date} className='order-date-group'>
            {/* Display the date as a header */}
            <h4 className='order-date'>{moment(date).format('MMMM Do, YYYY')}</h4>

            {/* Display the orders for that date */}
            {groupedOrders[date].map((order, index) => (
              <div key={index} className='order-item'>
                <img src={assets.parcel_icon} alt="" />
                <div>
                  <p className='order-item-name'>{order.name}</p>
                  <p className='order-item-phone'>{order.phoneNumber}</p>
                  <p>{order.email}</p>
                </div>
                <div className='order-item-address'>
                    <p>{order.address}</p> {/* Display the address as a single string */}
                  </div>
                <p className='order-item-message'>{order.message || 'No additional message'}</p>

                <select
                  onChange={(event) => statusHandler(event, order._id)}
                  value={order.status}
                >
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            ))}
            {/* Add a separator after each date group */}
            <hr className="order-date-separator" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Orders;
