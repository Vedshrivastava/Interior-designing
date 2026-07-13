import React from 'react';
import '../styles/sidebar.css';
import { NavLink, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faList, faIdBadge, faMessage, faFolderPlus, faFolderOpen,
  faCubes, faBoxesStacked, faUsers, faTrash, faStar, faStarHalfStroke,
} from '@fortawesome/free-solid-svg-icons';
import { FINANCE_NAV_SECTIONS, financeModuleKeyForPath } from '../config/financeNav';

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
    label: 'Testimonials',
    items: [
      { to: '/add-testimonial',   icon: faStar,            label: 'Add Testimonial'  },
      { to: '/list-testimonials', icon: faStarHalfStroke,  label: 'Testimonials'     },
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
    { to: '/admin-requests', icon: faUsers, label: 'Requests'     },
    { to: '/recovery-bin',   icon: faTrash, label: 'Recovery Bin' },
  ],
};

const Sidebar = () => {
  const location = useLocation();
  const isFinance = location.pathname.startsWith('/finance');

  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isMaster   = storedUser.role === 'MASTER';

  // Finance-module visibility only (Settings build) — unset
  // allowedFinanceModules or role MASTER means every section shows, same
  // as before this existed. Restricted ADMIN users only see items whose
  // derived module key (financeModuleKeyForPath) is in their list.
  const restrictedModules = (!isMaster && Array.isArray(storedUser.allowedFinanceModules)) ? storedUser.allowedFinanceModules : null;
  const financeSections = restrictedModules
    ? FINANCE_NAV_SECTIONS.map(section => ({
        ...section,
        items: section.items.filter(item => restrictedModules.includes(financeModuleKeyForPath(item.to))),
      })).filter(section => section.items.length > 0)
    : FINANCE_NAV_SECTIONS;

  const sections = isFinance
    ? financeSections
    : (isMaster ? [...NAV_SECTIONS, MASTER_SECTION] : NAV_SECTIONS);

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
              end
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
