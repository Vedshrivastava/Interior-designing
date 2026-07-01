import React, { useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import '../styles/navbar.css';
import { assets } from '../assets/admin_assets/assets';
import { StoreContext } from '../context/StoreContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser, faRightFromBracket, faShield, faArrowRightToBracket,
  faBars, faXmark,
  faPlus, faList, faIdBadge, faMessage, faFolderPlus, faFolderOpen,
  faCubes, faBoxesStacked, faUsers, faTrash,
} from '@fortawesome/free-solid-svg-icons';

const NAV_SECTIONS = [
  {
    label: 'Designs',
    items: [
      { to: '/add',  icon: faPlus,         label: 'Add Design'   },
      { to: '/list', icon: faList,          label: 'Designs'      },
    ],
  },
  {
    label: 'Projects',
    items: [
      { to: '/add-project',   icon: faFolderPlus,  label: 'Add Project'  },
      { to: '/list-projects', icon: faFolderOpen,  label: 'Projects'     },
    ],
  },
  {
    label: 'Products',
    items: [
      { to: '/add-product',   icon: faCubes,        label: 'Add Product'  },
      { to: '/list-products', icon: faBoxesStacked, label: 'Products'     },
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

/* ── JWT helpers (no library needed — JWTs are just base64) ── */
const getTokenExpiry = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null; 
  } catch {
    return null;
  }
};

const isTokenExpired = (token) => {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  return Date.now() >= expiry;
};

/* ── Full-screen page loader ── */
export const PageLoader = ({ visible }) => {
  const [show, setShow] = useState(visible);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setFading(true);
      const t = setTimeout(() => setShow(false), 400);
      return () => clearTimeout(t);
    } else {
      setShow(true);
      setFading(false);
    }
  }, [visible]);

  if (!show) return null;

  return (
    <div className={`page-loader${fading ? ' fade-out' : ''}`}>
      <div className="loader-modal-box">
        <div className="loader-ring" />
        <div className="loader-brand">
          <strong>Curating Details</strong>
          <span>Please wait</span>
        </div>
        <div className="loader-dots">
          <span className="loader-dot" />
          <span className="loader-dot" />
          <span className="loader-dot" />
        </div>
      </div>
    </div>
  );
};

/* ── Navbar ── */
const MASTER_SECTION = {
  label: 'Master',
  items: [
    { to: '/admin-requests', icon: faUsers, label: 'Requests'     },
    { to: '/recovery-bin',   icon: faTrash, label: 'Recovery Bin' },
  ],
};

const Navbar = ({ setShowLogin, setAuthType }) => {
  const { token, setToken, setUserId, setUserEmail, setUserName, setIsLoggedIn } = useContext(StoreContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isMaster   = storedUser.role === 'MASTER';
  const mobileSections = isMaster ? [...NAV_SECTIONS, MASTER_SECTION] : NAV_SECTIONS;

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location]);

  /* ── Atomic logout — wrapped in useCallback so the effect can safely depend on it ── */
  const logout = useCallback((reason = null) => {
    // Wipe storage instantly
    ['token', 'userId', 'userName', 'userEmail', 'user'].forEach(k => localStorage.removeItem(k));

    // Clear all context state
    setToken(null);
    setUserId(null);
    setUserEmail(null);
    setUserName(null);
    if (setIsLoggedIn) setIsLoggedIn(false);

    // Hard redirect — pass reason so Login can show "session expired" banner
    const dest = reason ? `/?reason=${reason}` : '/';
    window.location.replace(dest);
  }, [setToken, setUserId, setUserEmail, setUserName, setIsLoggedIn]);

  // 3. NEW EFFECT: Catch manual token deletions from DevTools on route navigation
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (token && !storedToken) {
      logout('expired');
    }
  }, [location.pathname, token, logout]);

  /* ── Auto-logout when JWT expires ── */
  useEffect(() => {
    if (!token) return;

    if (isTokenExpired(token)) {
      logout('expired');
      return;
    }

    const expiry = getTokenExpiry(token);
    const msUntilExpiry = expiry - Date.now();
    const expiryTimer = setTimeout(() => logout('expired'), msUntilExpiry);

    const pollInterval = setInterval(() => {
      if (isTokenExpired(token)) logout('expired');
    }, 60_000);

    return () => {
      clearTimeout(expiryTimer);
      clearInterval(pollInterval);
    };
  }, [token, logout]);

  return (
    <>
      <div className="navbar">
        <div
          className="navbar-brand"
          onClick={() => navigate('/welcome')}
          style={{ cursor: 'pointer' }}
        >
          <img className="logo" src={assets.logo} alt="Logo" />
          <div className="navbar-brand-text">
            <strong>Shrivastava's</strong>
            <span>Elevate</span>
          </div>
        </div>

        <div className="navbar-right">
          {/* ── Mobile menu trigger — hidden on desktop ── */}
          {token && (
            <button
              className={`admin-menu-btn${menuOpen ? ' open' : ''}`}
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              <FontAwesomeIcon icon={menuOpen ? faXmark : faBars} />
            </button>
          )}

          {!token ? (
            <button
              className="navbar-signin-btn"
              onClick={() => {
                if (setAuthType) setAuthType('Login');
                setShowLogin(true);
              }}
            >
              <FontAwesomeIcon icon={faArrowRightToBracket} />
              Sign In
            </button>
          ) : (
            <>
              <div className="navbar-admin-badge">
                <FontAwesomeIcon icon={faShield} />
                Admin
              </div>

              <div className="navbar-profile">
                <div className="profile-trigger">
                  <FontAwesomeIcon icon={faUser} />
                </div>

                <ul className="nav-profile-dropdown">
                  <li onClick={() => navigate('/my-account')}>
                    <FontAwesomeIcon icon={faUser} />
                    My Account
                  </li>
                  <li className="logout-item" onClick={() => logout()}>
                    <FontAwesomeIcon icon={faRightFromBracket} />
                    Logout
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile nav overlay ── */}
      {token && (
        <>
          {/* Dark backdrop */}
          <div
            className={`admin-mobile-backdrop${menuOpen ? ' visible' : ''}`}
            onClick={() => setMenuOpen(false)}
          />

          {/* Slide-in panel */}
          <div className={`admin-mobile-nav${menuOpen ? ' open' : ''}`}>

            <div className="admin-mobile-nav-header">
              <span className="admin-mobile-nav-title">Navigation</span>
              <button
                className="admin-mobile-nav-close"
                onClick={() => setMenuOpen(false)}
                aria-label="Close"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <nav className="admin-mobile-nav-body">
              {mobileSections.map(({ label, items }) => (
                <div key={label} className="admin-mobile-nav-section">
                  <p className="admin-mobile-nav-section-label">{label}</p>
                  {items.map(({ to, icon, label: itemLabel }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className={({ isActive }) =>
                        `admin-mobile-nav-item${isActive ? ' active' : ''}`
                      }
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="admin-mobile-nav-icon">
                        <FontAwesomeIcon icon={icon} />
                      </span>
                      <span className="admin-mobile-nav-label">{itemLabel}</span>
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>

          </div>
        </>
      )}
    </>
  );
};

export default Navbar;