import React, { useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // 1. Added useLocation
import '../styles/navbar.css';
import { assets } from '../assets/admin_assets/assets';
import { StoreContext } from '../context/StoreContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faRightFromBracket, faShield, faArrowRightToBracket } from '@fortawesome/free-solid-svg-icons';

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
const Navbar = ({ setShowLogin, setAuthType }) => {
  const { token, setToken, setUserId, setUserEmail, setUserName, setIsLoggedIn } = useContext(StoreContext);
  const navigate = useNavigate();
  const location = useLocation(); // 2. Initialized location hook

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
    <div className="navbar">
      <div
        className="navbar-brand"
        onClick={() => navigate('/welcome')}
        style={{ cursor: 'pointer' }}
      >
        <img className="logo" src={assets.logo} alt="Logo" />
        <div className="navbar-brand-text">
          <strong>Shrivastava's</strong>
          <span>Admin Panel</span>
        </div>
      </div>

      <div className="navbar-right">
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
                <li>
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
  );
};

export default Navbar;