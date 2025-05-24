import React, { useEffect, useState } from 'react';
import '../styles/orders.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import { assets } from '../assets/admin_assets/assets';
import moment from 'moment'; // Import moment.js for date formatting

const Orders = ({ url }) => {
  const [orders, setOrders] = useState([]);
  const token = localStorage.getItem('token');

  // Fetch all orders (both paid and unpaid)
  const fetchAllOrders = async () => {
    try {
      const response = await axios.get(`${url}/api/appointment/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setOrders(response.data.appointments); // Set orders if response is successful
      } else {
        console.log(response);
        toast.error('Error fetching orders');
      }
    } catch (error) {
      toast.error('Failed to fetch orders');
      console.error(error);
    }
  };

  // Group orders by date
  const groupOrdersByDate = (orders) => {
    return orders.reduce((groups, order) => {
      const date = moment(order.date).format('YYYY-MM-DD');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(order);
      return groups;
    }, {});
  };

  // Update the status of an order
  const statusHandler = async (event, orderId) => {
    const newStatus = event.target.value;

    try {
      const response = await axios.post(
        `${url}/api/appointment/status`,
        { orderId, status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

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

    // Establish WebSocket connection
    const socket = new WebSocket('ws://localhost:3000');

    // Log when connection is opened
    socket.addEventListener('open', () => {
      console.log('WebSocket connection established.');
    });

    // Handle incoming WebSocket messages
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'newOrder':
          console.log('New order received:', message.data);
          setOrders((prevOrders) => 
            [message.data, ...prevOrders].sort((a, b) => new Date(b.date) - new Date(a.date))
          );          break;

        case 'updateOrderStatus':
          console.log('Order status updated:', message.data);
          setOrders((prevOrders) =>
            prevOrders
              .map((order) => 
                order._id === message.data._id ? { ...order, status: message.data.status } : order
              )
              .sort((a, b) => new Date(b.date) - new Date(a.date))
          );
          break;

        // Add more cases as needed
      }
    });

    // Clean up WebSocket connection on unmount
    return () => {
      socket.close();
    };
  }, []);

  // Group orders by date
  const groupedOrders = groupOrdersByDate(orders);

  return (
    <div className='order add'>
      <h3>Order Page</h3>
      <div className='order-list'>
        {Object.keys(groupedOrders).map((date) => (
          <div key={date} className='order-date-group'>
            <h4 className='order-date'>{moment(date).format('MMMM Do, YYYY')}</h4>
            {groupedOrders[date].map((order, index) => (
              <div key={index} className='order-item'>
                <img src={assets.parcel_icon} alt="" />
                <div>
                  <p className='order-item-name'>{order.name}</p>
                  <p className='order-item-phone'>{order.phoneNumber}</p>
                  <p>{order.email}</p>
                </div>
                <div className='order-item-address'>
                  <p>{order.address}</p>
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
            <hr className="order-date-separator" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Orders;
