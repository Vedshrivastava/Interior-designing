import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom'; // <-- Added for multi-image portal view tracking
import '../styles/quotes.css';
import '../styles/list.css'; // <-- Added to inherit premium lightbox overlay styles
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment';
import '@fortawesome/fontawesome-free/css/all.min.css';

const Quotes = ({ url }) => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const token = localStorage.getItem('token');

  // --- LIGHTBOX PORTAL STATES (Ported from List.jsx) ---
  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0, name: '' });

  const openLightbox = (images, index, name) => {
    setLightbox({ open: true, images, index, name });
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = useCallback(() => {
    setLightbox({ open: false, images: [], index: 0, name: '' });
    document.body.style.overflow = '';
  }, []);

  const lbGoPrev = useCallback((e) => {
    e.stopPropagation();
    setLightbox(prev => ({ ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length }));
  }, []);

  const lbGoNext = useCallback((e) => {
    e.stopPropagation();
    setLightbox(prev => ({ ...prev, index: (prev.index + 1) % prev.images.length }));
  }, []);

  // Sync keyboard left/right arrow key controls
  useEffect(() => {
    if (!lightbox.open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft')  setLightbox(prev => ({ ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length }));
      if (e.key === 'ArrowRight') setLightbox(prev => ({ ...prev, index: (prev.index + 1) % prev.images.length }));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightbox.open, closeLightbox]);

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
    setIsLoading(true);
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
          toast.info(`💬 New quote request from ${message.data.name}`);
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

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard`);
  };

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

      {/* --- LIGHTBOX MODAL PORTAL --- */}
      {lightbox.open && ReactDOM.createPortal(
        <div className="lb-overlay" onClick={closeLightbox}>
          <button className="lb-close" onClick={closeLightbox} aria-label="Close">✕</button>

          {lightbox.images.length > 1 && (
            <button className="lb-arrow lb-arrow--prev" onClick={lbGoPrev} aria-label="Previous">&#8249;</button>
          )}

          <div className="lb-img-wrap" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.images[lightbox.index]}
              alt={`${lightbox.name} — ${lightbox.index + 1}`}
              className="lb-img"
            />
            <div className="lb-caption">
              <span className="lb-name">{lightbox.name}</span>
              {lightbox.images.length > 1 && (
                <span className="lb-counter">{lightbox.index + 1} / {lightbox.images.length}</span>
              )}
            </div>
          </div>

          {lightbox.images.length > 1 && (
            <button className="lb-arrow lb-arrow--next" onClick={lbGoNext} aria-label="Next">&#8250;</button>
          )}
        </div>,
        document.body
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
              {groupedOrders[date].map((order, index) => {
                
                // Safe checking to process either new 'images' arrays or old 'image' singular values
                const orderImages = order.images && order.images.length > 0
                  ? order.images
                  : (Array.isArray(order.image)
                      ? order.image
                      : (order.image ? [order.image] : []));
                
                const displayImage = orderImages[0];

                return (
                  <div key={index} className="order-item">
                    <div className="order-icon-wrapper">
                      {displayImage ? (
                        <img
                          src={displayImage}
                          alt="Design"
                          className="lb-trigger"
                          onClick={() => openLightbox(orderImages, 0, order.designName || order.name)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in' }}
                        />
                      ) : (
                        <i className="fa-solid fa-image"></i>
                      )}
                    </div>

                    {/* Column 2: Consolidated Info */}
                    <div className="order-content-wrapper">
                      <div className="order-header-block">
                        <strong className="order-customer-name">{order.name}</strong>
                        <div className="order-contact-row">
                          <span className="contact-item">
                            <a href={`tel:${order.phoneNumber}`} className="contact-link" title="Call Customer">
                              <i className="fa-solid fa-phone"></i> {order.phoneNumber}
                            </a>
                            <i 
                              className="fa-regular fa-copy copy-icon" 
                              onClick={() => handleCopy(order.phoneNumber, 'Phone number')}
                              title="Copy Phone"
                            ></i>
                          </span>
                          <span className="contact-dot">•</span>
                          <span className="contact-item">
                            <a href={`mailto:${order.email}`} className="contact-link" title="Email Customer">
                              <i className="fa-solid fa-envelope"></i> {order.email}
                            </a>
                            <i 
                              className="fa-regular fa-copy copy-icon" 
                              onClick={() => handleCopy(order.email, 'Email address')}
                              title="Copy Email"
                            ></i>
                          </span>
                        </div>
                      </div>

                      <div className="order-info-row">
                        <div className="info-chip design-chip">
                          <strong>Design:</strong> <span>{order.designName || 'N/A'}</span>
                        </div>
                        <div className="info-chip">
                          <strong>Cat:</strong> <span>{order.category || 'N/A'}</span>
                        </div>
                        <div className="info-chip">
                          <strong>Size:</strong> <span>{order.measurements || 'N/A'}</span>
                        </div>
                        <div className="info-chip address-chip">
                          <i className="fa-solid fa-location-dot"></i> <span>{order.address}</span>
                        </div>
                      </div>
                    </div>

                    {/* Column 3: Actions */}
                    <div className="order-item-actions">
                      <select onChange={(e) => statusHandler(e, order._id)} value={order.status}>
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>

                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Quotes;