import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/mainNavbar.css';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarCheck } from '@fortawesome/free-solid-svg-icons';

const NAV_LINKS = [
  { label: 'Home',            to: '/'        },
  { label: 'Services',        to: '/services' },
  { label: 'Recent Projects', to: '/projects' },
  { label: 'About',           to: '/about'   },
  { label: 'Contact',         to: '/contact' },
];

const MainNavbar = ({ setShowLogin }) => {
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [scrolled,  setScrolled]  = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();
  const navRef    = useRef(null);

  /* ── scroll detection — fills bg when page scrolls down ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── close menu on route change ── */
  useEffect(() => { setMenuOpen(false); }, [location]);

  /* ── close menu on outside click ── */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = e => {
      if (navRef.current && !navRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <nav className="mainNavbar" ref={navRef}>
      <div className={`mainNavbar-container${scrolled ? ' scrolled' : ''}`}>

        {/* ── LOGO ── */}
        <Link to="/" className="mainNavbar-logo" onClick={() => setMenuOpen(false)}>
          <img src={logo} alt="Shrivastava's Elevate" />
          <div className="mainNavbar-logo-text">
            <strong>Shrivastava's</strong>
            <span>Elevate</span>
          </div>
        </Link>

        {/* ── LINKS ── */}
        <div className={`mainNavbar-links-container${menuOpen ? ' open' : ''}`}>
          <ul className="mainNavbar-links">

            {NAV_LINKS.map(({ label, to }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={location.pathname === to ? 'active-link' : ''}
                >
                  {label}
                </Link>
              </li>
            ))}

            {/* CTA */}
            <li>
              <button
                className="consult-online"
                onClick={() => { setShowLogin(true); setMenuOpen(false); }}
              >
                Consult Online <FontAwesomeIcon icon={faCalendarCheck} />
              </button>
            </li>

          </ul>
        </div>

        {/* ── HAMBURGER ── */}
        <div
          className={`hamburger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setMenuOpen(v => !v)}
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </div>

      </div>
    </nav>
  );
};

export default MainNavbar;
