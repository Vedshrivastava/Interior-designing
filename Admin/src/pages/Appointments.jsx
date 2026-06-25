import React, { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import '../styles/appointments.css';
import '../styles/list.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment'; 
import '@fortawesome/fontawesome-free/css/all.min.css';

const Appointments = ({ url }) => {
  const [orders, setOrders] = useState([]);
  const [query,  setQuery]  = useState('');
  const token = localStorage.getItem('token');

  const fetchAllAppointments = async () => {
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
        fetchAllAppointments(); 
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  useEffect(() => { fetchAllAppointments(); }, []);

  useWebSocket(useCallback((message) => {
    switch (message.type) {
      case 'newOrder':
        setOrders(prev => [message.data, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date)));
        toast.info(`📋 New appointment from ${message.data.name}`);
        break;
      case 'updateOrderStatus':
        setOrders(prev =>
          prev.map(o => o._id === message.data._id ? { ...o, status: message.data.status } : o)
              .sort((a, b) => new Date(b.date) - new Date(a.date))
        );
        break;
      default: break;
    }
  }, []));

  const filteredOrders = !query ? orders : orders.filter(o => {
    const q = query.toLowerCase();
    return (o.name?.toLowerCase().includes(q) ||
            o.phoneNumber?.toLowerCase().includes(q) ||
            o.email?.toLowerCase().includes(q));
  });
  const groupedOrders = groupOrdersByDate(filteredOrders);

  return (
    <div className='appointments-container'>
      <div className="admin-search-header">
        <div>
          <h2 className="admin-search-title">Appointments</h2>
          <p className="admin-search-sub">{filteredOrders.length} appointment{filteredOrders.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="admin-search-wrap">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="text"
            placeholder="Search by name, phone or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && <button className="admin-search-clear" onClick={() => setQuery('')}>×</button>}
        </div>
      </div>
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

export default Appointments;
