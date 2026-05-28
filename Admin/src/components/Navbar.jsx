import React, { useContext, useState, useEffect } from 'react';
import '../styles/navbar.css';
import { assets } from '../assets/admin_assets/assets';
import { StoreContext } from '../context/StoreContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faRightFromBracket, faShield, faArrowRightToBracket } from '@fortawesome/free-solid-svg-icons';

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
      <div className="loader-brand">
        <strong>Shrivastava's</strong>
        <span>Admin Panel</span>
      </div>
      <div className="loader-ring" />
      <div className="loader-dots">
        <span className="loader-dot" />
        <span className="loader-dot" />
        <span className="loader-dot" />
      </div>
    </div>
  );
};

/* ── Navbar ── */
const Navbar = ({ setShowLogin }) => {
  const { token, setToken, setUserId, setUserEmail, setUserName } = useContext(StoreContext);

  const logout = () => {
    setToken(null);
    setUserId(null);
    setUserEmail(null);
    setUserName(null);
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
  };

  return (
    <div className="navbar">

      {/* ── Brand ── */}
      <div className="navbar-brand">
        <img className="logo" src={assets.logo} alt="Logo" />
        <div className="navbar-brand-text">
          <strong>Shrivastava's</strong>
          <span>Admin Panel</span>
        </div>
      </div>

      {/* ── Right section ── */}
      <div className="navbar-right">
        {!token ? (
          <button
            className="navbar-signin-btn"
            onClick={() => setShowLogin(true)}
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
                <li>
                  <FontAwesomeIcon icon={faUser} />
                  My Account
                </li>
                <li className="logout-item" onClick={logout}>
                  <FontAwesomeIcon icon={faRightFromBracket} />
                  Logout
                </li>
              </ul>
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default Navbar;
