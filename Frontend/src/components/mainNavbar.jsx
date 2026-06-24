import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/mainNavbar.css';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarCheck, faCompass, faCircleInfo,
  faEnvelope, faChevronRight,
} from '@fortawesome/free-solid-svg-icons';

// mobileHide: true  → in bottom navbar already; hidden from hamburger on mobile
// matchPath        → use startsWith() for active detection instead of exact match
// icon / desc      → mobile hamburger card only (mobileHide:true items never render them)
const NAV_LINKS = [
  { label: 'Services', to: '/services',                 matchPath: null,     mobileHide: false, icon: faCompass,    desc: 'What we offer'   },
  { label: 'Designs',  to: '/design/Kitchen%20Designs', matchPath: '/design',mobileHide: true,  icon: null,         desc: null              },
  { label: 'Products', to: '/products',                 matchPath: null,     mobileHide: true,  icon: null,         desc: null              },
  { label: 'Projects', to: '/projects',                 matchPath: null,     mobileHide: true,  icon: null,         desc: null              },
  { label: 'About',    to: '/about',                    matchPath: null,     mobileHide: false, icon: faCircleInfo, desc: 'Our story & team'},
  { label: 'Contact',  to: '/contact',                  matchPath: null,     mobileHide: false, icon: faEnvelope,   desc: 'Get in touch'    },
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

            {NAV_LINKS.map(({ label, to, matchPath, mobileHide, icon, desc }) => {
              const isActive = matchPath
                ? location.pathname.startsWith(matchPath)
                : location.pathname === to;
              return (
              <li key={to} className={mobileHide ? 'nav-mobile-hidden' : ''}>
                <Link
                  to={to}
                  className={isActive ? 'active-link' : ''}
                >
                  {/* Icon badge — mobile only (hidden via CSS on desktop) */}
                  {icon && (
                    <span className="nav-link-icon-wrap">
                      <FontAwesomeIcon icon={icon} />
                    </span>
                  )}

                  {/* Text — on desktop just the label; on mobile label + desc stacked */}
                  <span className="nav-link-text-wrap">
                    <span className="nav-link-label">{label}</span>
                    {desc && <span className="nav-link-desc">{desc}</span>}
                  </span>

                  {/* Chevron — mobile only */}
                  {icon && (
                    <FontAwesomeIcon icon={faChevronRight} className="nav-link-chevron" />
                  )}
                </Link>
              </li>
              );
            })}

            {/* CTA — hidden on mobile since bottom nav has Consult tab */}
            <li className="nav-mobile-hidden">
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
