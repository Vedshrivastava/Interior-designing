import React from 'react';
import '../styles/sidebar.css';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faList, faIdBadge, faMessage,
} from '@fortawesome/free-solid-svg-icons';

const NAV_ITEMS = [
  { to: '/add',          icon: faPlus,    label: 'Add New'      },
  { to: '/list',         icon: faList,    label: 'List Items'   },
  { to: '/appointments', icon: faIdBadge, label: 'Appointments' },
  { to: '/quotes',       icon: faMessage, label: 'Quotes'       },
];

const Sidebar = () => {
  return (
    <div className="sidebar">

      <div className="sidebar-options">
        <p className="sidebar-section-label">Menu</p>

        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            data-label={label}
            className={({ isActive }) =>
              `sidebar-option${isActive ? ' active' : ''}`
            }
          >
            <span className="sidebar-option-icon">
              <FontAwesomeIcon icon={icon} />
            </span>
            <p>{label}</p>
          </NavLink>
        ))}

      </div>
    </div>
  );
};

export default Sidebar;
