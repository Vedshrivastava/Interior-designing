import React, { useEffect, useState } from 'react';
import '../styles/quotes.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment';
import '@fortawesome/fontawesome-free/css/all.min.css';

const Quotes = ({ url }) => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const token = localStorage.getItem('token');

  const fetchAllOrders = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${url}/api/appointment/list-quotes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setOrders(response.data.appointments.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } else {
        toast.error('Error fetching quotes');
      }
    } catch (error) {
      toast.error('Failed to fetch quotes');
    } finally {
      setIsLoading(false);
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
    setIsLoading(true); // Optional: Show loader while updating status
    try {
      const response = await axios.post(
        `${url}/api/appointment/status`,
        { orderId, status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        await fetchAllOrders();
        toast.success('Status updated successfully');
      } else {
        toast.error('Failed to update quote status');
      }
    } catch (error) {
      toast.error('Failed to update quote status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllOrders();

    const socket = new WebSocket('ws://localhost:3000');
    socket.addEventListener('open', () => console.log('WebSocket connection established.'));

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'newQuote':
          setOrders((prevOrders) => 
            [message.data, ...prevOrders].sort((a, b) => new Date(b.date) - new Date(a.date))
          );
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
        default:
          break;
      }
    });

    return () => socket.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupedOrders = groupOrdersByDate(orders);

  return (
    <div className="order">
      {/* CSS Loader Overlay */}
      {isLoading && (
        <div className="submit-loader-overlay">
          <div className="loader-modal-box">
            <div className="loader-ring"></div>
            <p>Curating Details</p>
            <span>Please wait a moment...</span>
          </div>
        </div>
      )}

      <div className="order-list">
        {Object.keys(groupedOrders).length === 0 && !isLoading ? (
          <div className="empty-state">
            <p>No quotes available at this time.</p>
          </div>
        ) : (
          Object.keys(groupedOrders).map((date) => (
            <div key={date} className="order-date-group">
              <h4 className="order-date">{moment(date).format('MMMM Do, YYYY')}</h4>
              
              {groupedOrders[date].map((order, index) => (
                <div key={index} className="order-item quote-item">
                  
                  {/* Column 1: Media */}
                  <div className="order-icon-wrapper quote-media">
                    {order.image ? (
                      <img src={order.image} alt={order.designName || 'Design'} />
                    ) : (
                      <i className="fa-solid fa-image"></i>
                    )}
                  </div>
                  
                  {/* Column 2: Main Details */}
                  <div className="order-item-main-details">
                    <p className="order-item-name">{order.name}</p>
                    <p className="order-item-phone">{order.phoneNumber}</p>
                    <p className="order-item-email">{order.email}</p>
                    <p className="order-item-design-name">
                      {order.designName || 'No design name'}
                    </p>
                  </div>
                  
                  {/* Column 3: Address */}
                  <div className="order-item-address">
                    <p>{order.address}</p>
                  </div>

                  {/* Column 4: Actions */}
                  <div className="order-item-actions">
                    <select onChange={(event) => statusHandler(event, order._id)} value={order.status}>
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Quotes;