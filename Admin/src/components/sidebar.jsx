import React from 'react';
import '../styles/sidebar.css';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faList, faIdBadge, faMessage, faFolderPlus, faFolderOpen,
  faCubes, faBoxesStacked, faUsers,
} from '@fortawesome/free-solid-svg-icons';

const NAV_SECTIONS = [
  {
    label: 'Designs',
    items: [
      { to: '/add',  icon: faPlus, label: 'Add Design' },
      { to: '/list', icon: faList, label: 'Designs'    },
    ],
  },
  {
    label: 'Projects',
    items: [
      { to: '/add-project',   icon: faFolderPlus, label: 'Add Project' },
      { to: '/list-projects', icon: faFolderOpen, label: 'Projects'    },
    ],
  },
  {
    label: 'Products',
    items: [
      { to: '/add-product',   icon: faCubes,        label: 'Add Product' },
      { to: '/list-products', icon: faBoxesStacked, label: 'Products'    },
    ],
  },
  {
    label: 'Clients',
    items: [
      { to: '/appointments', icon: faIdBadge, label: 'Appointments' },
      { to: '/quotes',       icon: faMessage, label: 'Quotes'       },
    ],
  },
];

const MASTER_SECTION = {
  label: 'Master',
  items: [
    { to: '/admin-requests', icon: faUsers, label: 'Requests' },
  ],
};

const Sidebar = () => {
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isMaster   = storedUser.role === 'MASTER';

  const sections = isMaster ? [...NAV_SECTIONS, MASTER_SECTION] : NAV_SECTIONS;

  return (
    <div className="sidebar">
      {sections.map(({ label, items }, si) => (
        <div key={label} className="sidebar-options">
          {si > 0 && <div className="sidebar-divider" />}
          <p className="sidebar-section-label">{label}</p>

          {items.map(({ to, icon, label: itemLabel }) => (
            <NavLink
              key={to}
              to={to}
              data-label={itemLabel}
              className={({ isActive }) => `sidebar-option${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-option-icon">
                <FontAwesomeIcon icon={icon} />
              </span>
              <p>{itemLabel}</p>
            </NavLink>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Sidebar;
