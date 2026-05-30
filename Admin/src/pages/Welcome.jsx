import React from 'react';
import { useNavigate } from 'react-router-dom';
// 1. Import the FontAwesomeIcon component
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; 
import '../styles/welcome.css';
import {
    faPlus, faList, faIdBadge, faMessage,
} from '@fortawesome/free-solid-svg-icons';

const WelcomeScreen = () => {
  const navigate = useNavigate();

  const shortcuts = [
    { icon: faPlus, label: 'Add Product', desc: 'List a new item to your catalogue', path: '/add' },
    { icon: faList, label: 'Product List', desc: 'View and manage existing items', path: '/list' },
    { icon: faIdBadge, label: 'Appointments', desc: 'Track and manage bookings', path: '/appointments' },
    { icon: faMessage, label: 'Quotes', desc: 'Review and send customer quotes', path: '/quotes' },
  ];

  return (
    <div className="welcome-container">
      <span className="welcome-badge">Admin Dashboard</span>
      <h1>Welcome back to <em>your</em> workspace</h1>
      <p>Everything you need to manage your business is just a click away.</p>
      <div className="welcome-divider">
        {/* Note: If you want this divider icon to work with Font Awesome too, change it below */}
        <span /><i className="ti ti-leaf" /><span />
      </div>
      <div className="welcome-cards">
        {shortcuts.map(({ icon, label, desc, path }) => (
          <div key={path} className="welcome-card" onClick={() => navigate(path)}>
            {/* 2. Use the FontAwesomeIcon component here */}
            <div className="welcome-card-icon">
              <FontAwesomeIcon icon={icon} />
            </div>
            <h3>{label}</h3>
            <p>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WelcomeScreen;