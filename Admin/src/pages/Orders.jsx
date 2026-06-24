import React, { useEffect, useState } from 'react';
import '../styles/orders.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment'; 
import '@fortawesome/fontawesome-free/css/all.min.css';

const Orders = ({ url }) => {
  const [orders, setOrders] = useState([]);
  const token = localStorage.getItem('token');

  const fetchAllOrders = async () => {
    try {
      const response = await axios.get(`${url}/api/appointment/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setOrders(response.data.appointments); 
      } else {
        toast.error('Error fetching appointments');
      }
    } catch (error) {
      toast.error('Failed to fetch appointments');
    }
  };

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

  const statusHandler = async (event, orderId) => {
    const newStatus = event.target.value;
    try {
      const response = await axios.post(
        `${url}/api/appointment/status`,
        { orderId, status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        fetchAllOrders(); 
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  useEffect(() => {
    fetchAllOrders(); 

    const socket = new WebSocket('ws://localhost:3000');
    socket.addEventListener('open', () => console.log('WebSocket connection established.'));

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'newOrder':
          setOrders((prevOrders) =>
            [message.data, ...prevOrders].sort((a, b) => new Date(b.date) - new Date(a.date))
          );
          toast.info(`📋 New appointment from ${message.data.name}`);
          break;
        case 'updateOrderStatus':
          setOrders((prevOrders) =>
            prevOrders
              .map((order) => 
                order._id === message.data._id ? { ...order, status: message.data.status } : order
              )
              .sort((a, b) => new Date(b.date) - new Date(a.date))
          );
          break;
      }
    });

    return () => socket.close();
  }, []);

  const groupedOrders = groupOrdersByDate(orders);

  return (
    <div className='appointments-container'>
      <div className='appointment-list'>
        {Object.keys(groupedOrders).map((date) => (
          <div key={date} className='appointment-date-group'>
            <h4 className='appointment-date'>{moment(date).format('MMMM Do, YYYY')}</h4>
            
            {groupedOrders[date].map((order, index) => (
              <div key={index} className='appointment-item'>
                <div className="appointment-icon-wrapper">
                   <i className="fa-solid fa-clipboard-list"></i>
                </div>
                
                <div className='appointment-main-details'>
                  <p className='appointment-name'>{order.name}</p>
                  <p className='appointment-phone'>{order.phoneNumber}</p>
                  <p className='appointment-email'>{order.email}</p>
                </div>
                
                <div className='appointment-address'>
                  <p>{order.address}</p>
                </div>
                
                <div className='appointment-message-box'>
                  <p className='appointment-message'>{order.message || 'No additional message'}</p>
                </div>
                
                <div className="appointment-actions">
                  <select onChange={(event) => statusHandler(event, order._id)} value={order.status}>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Orders;